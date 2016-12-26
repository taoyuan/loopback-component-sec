"use strict";

const debug = require('debug')('loopback:component:sec:auto-add-roles');
const _ = require('lodash');
const Promise = require('bluebird');
const chalk = require('chalk');

module.exports = function (sec) {
	const {acl} = sec;

	debug(chalk.yellow('Setup Auto Add Roles Observer'));
	sec.groups.forEach(attachAfterSaveObserver);

	// ----------------------------------------------------------------
	//  Internal Functions
	// ----------------------------------------------------------------
	function attachAfterSaveObserver(Model) {
		if (typeof Model.observe !== 'function') return;

		debug('Attaching Auto Add Roles Observer to %s', Model.modelName);

		const modelName = Model.modelName;
		const mni = chalk.blue(modelName);

		Model.observe('after save', (ctx, next) => {
			// only allow default permission for new instance
			if (!ctx.isNewInstance) {
				return next();
			}

			const currentUserId = sec.getCurrentUserId(ctx.options);
			const roles = Object.keys(Model.security.roles);

			debug('%s - Adding roles %j to "%s:%s"', mni, roles, modelName, ctx.instance.id);
			Promise.map(roles, role => acl.scoped(ctx.instance).addRole(role))
				.then(roles => {
					if (currentUserId) {
						return Promise.filter(roles, role => sec.opts.defaultCreatorRoles.includes(role.name));
					}
				})
				.then(roles => {
					if (roles && roles.length) {
						debug('%s - Adding user "%s" to roles %j of "%s:%s"', mni, currentUserId, _.map(roles, r => r.name), modelName, ctx.instance.id);
						return acl.assignRolesUsers(roles, currentUserId);
					}
				})
				.nodeify(next);
		});
	}
};

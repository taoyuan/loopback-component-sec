"use strict";

const debug = require('debug')('loopback:component:sec:add-roles');
const _ = require('lodash');
const Promise = require('bluebird');
const chalk = require('chalk');

module.exports = function (sec) {
	const {acl} = sec;

	debug(chalk.yellow('Setup roles adding observer for group models'));
	sec.groups.forEach(attachAfterSaveObserver);

	// ----------------------------------------------------------------
	//  Internal Functions
	// ----------------------------------------------------------------
	function attachAfterSaveObserver(Model) {
		if (typeof Model.observe !== 'function') return;

		debug('Attaching add roles observer to %s', Model.modelName);

		const modelName = Model.modelName;
		const mni = chalk.green(modelName);

		Model.observe('after save', (ctx, next) => {
			// only allow default permission for new instance
			if (!ctx.isNewInstance) {
				return next();
			}

			debug('%s - begin', mni);

			const currentUserId = sec.getCurrentUserId(ctx.options);
			debug('%s - Current user id: %s', mni, currentUserId);

			const roles = Object.keys(Model.security.roles);
			debug('%s - Add roles %j to "%s:%s"', mni, roles, modelName, ctx.instance.id);

			Promise.map(roles, role => acl.scoped(ctx.instance).addRole(role))
				.then(roles => {
					if (currentUserId) {
						return Promise.filter(roles, role => sec.opts.defaultCreatorRoles.includes(role.name));
					}
				})
				.then(roles => {
					if (roles && roles.length) {
						debug('%s - Assign current user "%s" to roles %j of "%s:%s"', mni, currentUserId, _.map(roles, r => r.name), modelName, ctx.instance.id);
						return acl.scoped({type: modelName, id: ctx.instance.id}).assignRolesUsers(roles, currentUserId);
					}
				})
				.nodeify(next);
		});
	}
};

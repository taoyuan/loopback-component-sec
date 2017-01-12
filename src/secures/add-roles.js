"use strict";

const debug = require('debug')('loopback:component:gsec:add-roles');
const _ = require('lodash');
const PromiseA = require('bluebird');
const chalk = require('chalk');
const arrify = require('arrify');

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

		Model.observe('after save', (ctx) => {
			// only allow default permission for new instance
			if (!ctx.isNewInstance) {
				return PromiseA.resolve();
			}

			debug('%s - begin', mni);

			const currentUserId = sec.getCurrentUserId(ctx.options);
			debug('%s - Current user id: %s', mni, currentUserId);

			const defs = Model.security.roles;
			const names = Object.keys(defs);
			debug('%s - Add roles %j to "%s:%s"', mni, names, modelName, ctx.instance.id);

			return PromiseA.map(names, role => acl.scoped(ctx.instance).addRole(role))
				.map(role => {
					const inherits = arrify(_.get(defs, role.name + '.inherits'));
					if (!_.isEmpty(inherits)) {
						return acl.inheritRoleFrom(role, inherits).thenReturn(role);
					}
					return role;
				})
				.then(roles => {
					if (currentUserId) {
						return PromiseA.filter(roles, role => sec.opts.defaultCreatorRoles.includes(role.name));
					}
				})
				.then(roles => {
					if (roles && roles.length) {
						debug('%s - Assign current user "%s" to roles %j of "%s:%s"', mni, currentUserId, _.map(roles, r => r.name), modelName, ctx.instance.id);
						return acl.scoped({type: modelName, id: ctx.instance.id}).assignMemberships(currentUserId, roles, 'active');
					}
				});
		});
	}
};

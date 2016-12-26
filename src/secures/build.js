"use strict";

const debug = require('debug')('loopback:component:sec:build');
const g = require('strong-globalize')();
const _ = require('lodash');
const deprecated = require('depd')('loopback:component:sec:build');
const utils = require('../utils');

module.exports = function (sec) {
	const {groups, resources} = sec;

	debug('build models security for group models %j and resource models %j',
		utils.toModelsNames(groups), utils.toModelsNames(resources));

	const models = sec.models;
	_.forEach(models, model => transform(model));
	_.forEach(groups, group => buildGroupRoles(group, resources));

	// ----------------------------------------------------------------
	//  Internal Functions
	// ----------------------------------------------------------------

	function transform(model) {
		const securitySettings = model.settings.security || {};
		const security = model.security = model.security || {};

		let {roles, actions, permissions} = securitySettings;

		if (!permissions && _.has(securitySettings, 'default-permissions')) {
			deprecated('"default-permissions" has been deprecated, using "permissions" instead');
			permissions = securitySettings['default-permissions'];
		}

		if (!sec.isGroupModel(model)) {
			actions = actions || sec.opts.defaultActions;
			permissions = permissions || sec.opts.defaultPermissions;
		}

		if (roles) {
			security.roles = _.transform(roles, normalizer(model.modelName, 'roles'), {});
		}

		if (actions) {
			if (Array.isArray(actions)) {
				actions = _.zipObject(actions, actions);
			}
			security.actions = _.transform(actions, normalizer(model.modelName, 'actions'), {});
		}

		if (permissions) {
			security.permissions = _.transform(permissions, (result, v, k) => result[k] = utils.sureArray(v), {});
		}
	}

	function buildGroupRoles(group, resources) {
		const groupSecurity = group.security;
		_.forEach(resources, resource => {
			if (group === resource) return;
			const resourceSecurity = resource.security;
			if (resourceSecurity.actions) {
				const resourceActions = _.transform(resourceSecurity.actions, (result, action, key) => {
					key = _.toUpper(resource.modelName + ":" + key);
					result[key] = Object.assign({}, action, {name: key});
					return result;
				}, {});
				groupSecurity.actions = Object.assign(groupSecurity.actions || {}, resourceActions);
			}

			if (!resourceSecurity.permissions) return;

			_.forEach(groupSecurity.roles, role => {
				let permittedActions = resourceSecurity.permissions[role.name];
				if (!permittedActions) return;
				if (permittedActions.includes('*')) {
					permittedActions = Object.keys(groupSecurity.actions);
				}
				permittedActions = _.map(permittedActions, permit => _.toUpper(resource.modelName + ":" + permit));
				role.actions = _.concat(role.actions, permittedActions);
			});
		});
	}
};

function normalizer(modelName, property) {
	return (result, val, key) => {
		if (typeof val === 'string') {
			val = {title: val};
		}
		if (typeof val !== 'object') {
			throw new Error(g.f('Invalid settings for model %s security settings %s.%s', modelName, property, key));
		}
		val.name = key;
		result[key] = val;
		return result;
	};
}

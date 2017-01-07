"use strict";

const debug = require('debug')('loopback:component:gsec:build');
const g = require('strong-globalize')();
const _ = require('lodash');
const deprecated = require('depd')('loopback:component:gsec:build');
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
		const settings = model.settings.sec || model.settings.security || {};
		const security = model.security = model.security || {};

		let {roles, actions, permissions} = settings;

		if (!permissions && _.has(settings, 'default-permissions')) {
			deprecated('"default-permissions" has been deprecated, using "permissions" instead');
			permissions = settings['default-permissions'];
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
		const gs = group.security;
		_.forEach(resources, resource => {
			if (group === resource) return;

			gs.actions = _.fromPairs(_.toPairs(gs.actions).map(([k, v]) => {
				k = _.toUpper(k);
				if (_.get(v, 'name')) {
					v.name = _.toUpper(v.name);
				}
				return [k, v];
			}));

			const rs = resource.security;
			if (rs.actions) {
				const resourceActions = _.transform(rs.actions, (result, action, key) => {
					key = _.toUpper(resource.modelName + ":" + key);
					result[key] = Object.assign({}, action, {name: key});
					return result;
				}, {});
				gs.actions = Object.assign(gs.actions || {}, resourceActions);
			}

			if (!rs.permissions) return;

			_.forEach(gs.roles, role => {
				let permittedActions = rs.permissions[role.name];
				if (!permittedActions) return;
				if (permittedActions.includes('*')) {
					permittedActions = Object.keys(rs.actions);
				}
				permittedActions = _.map(permittedActions, permit => resource.modelName + ":" + permit);
				role.actions = _.concat(role.actions, permittedActions).map(_.toUpper);
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

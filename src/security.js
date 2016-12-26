"use strict";

const debug = require('debug')('loopback:component:sec:security');
const _ = require('lodash');
const assert = require('assert');
const nsec = require('nsec');
const LoopbackContext = require('loopback-context');
const Promise = require('bluebird');

const Actions = require('./actions');
const utils = require('./utils');

class Security {

	constructor(app, opts) {
		this.app = app;
		this.opts = opts = _.defaults({}, opts, {
			role: '$nsec',
			userModel: 'User',
			modelConfig: {
				public: false
			},
			defaultCreatorRoles: ['member', 'manager'],
			defaultActions: ["read", "write", "manage"],
			defaultPermissions: {
				member: "read",
				manager: ["write", "manage"],
				admin: "*"
			}
		});

		const DEFAULT_GROUP_OPTS = {rel: opts.rel, rowlevel: false};

		opts.groups = utils.sureArray(opts.groups || opts.groupModels);
		opts.defaultCreatorRoles = utils.sureArray(opts.defaultCreatorRoles);
		opts.resources = opts.resources || {};

		// normalize group options
		opts.resources = _.transform(opts.resources, (result, options, name) => {
			if (_.isString(options)) {
				options = {rel: options};
			} else if (_.isBoolean(options)) {
				options = {rowlevel: options};
			}

			if (options && _.isObject(options)) {
				result[name] = Object.assign({}, DEFAULT_GROUP_OPTS, options);
			}
		}, {});

		// resolve custom models
		let ds = opts.dataSource || opts.datasource || opts.ds;
		if (typeof ds === 'string') {
			ds = app.dataSources[ds];
		}

		const acl = this.acl = new nsec(ds, _.clone(opts));

		// Register nsec models to app
		_.map(acl.models, m => app.model(m, _.assign({dataSource: ds}, opts.modelConfig)));

		this.groups = _.map(opts.groups, group => this.app.registry.getModel(group));

		this.resources = _.filter(this.app.models, modelClass => {
			const modelName = modelClass.modelName;
			const options = opts.resources[modelName] || DEFAULT_GROUP_OPTS;
			const rel = modelClass.relations[options.rel];
			if (rel) {
				modelClass.__aclopts = options;
				const relModel = rel.modelThrough || rel.modelTo;
				return rel.type === 'belongsTo' && ((relModel && _.includes(this.groups, relModel)) || rel.polymorphic);
			}
		});

		this.models = _.union(this.groups, this.resources);
	}

	/**
	 * Get the currently logged in user.
	 *
	 * @returns {Object} Returns the currently logged in user.
	 */
	getCurrentUser() {
		const ctx = LoopbackContext.getCurrentContext();
		return (ctx && ctx.get('currentUser')) || null;
	}

	getCurrentUserId(options) {
		options = options || {};
		return _.get(options, 'accessToken.userId') || options.userId ||
			_.get(options, 'user.id') || _.get(this.getCurrentUser(), 'id');
	}

	// getCurrentSubjects(adminPatch = '$admin') {
	// 	const currentUserId = this.getCurrentUserId();
	// 	if (!currentUserId) return Promise.resolve();
	// 	return this.acl.scoped('*').findUserRoles(currentUserId, true).then(roleIds => {
	// 		if (adminPatch) {
	// 			return this.acl.hasRoles(currentUserId, 'admin').then(isAdmin => {
	// 				if (isAdmin) return roleIds.push(adminPatch);
	// 			}).thenReturn(roleIds);
	// 		}
	// 		return roleIds;
	// 	}).then(roleIds => _.concat(roleIds, currentUserId));
	// }

	getActionForMethod(Model, method) {
		if (typeof method === 'string') {
			method = {name: method};
		}

		assert(_.isObject(method), 'method is a required argument and must be a RemoteMethod object');

		const action = _.find(Model.actions, action => _.includes(action.methods, method.name));
		if (action) return action.name;
		return Actions.fromMethod(method.name, Actions.MANAGE);
	}

	isGroupModel(modelClass) {
		if (!modelClass) return false;
		return Boolean(_.find(this.groups, Model => {
			return modelClass === Model ||
				modelClass.prototype instanceof Model ||
				modelClass === Model.modelName;
		}));
	}

	relname(model) {
		if (!model) return;
		const Model = _.isFunction(model) ? model : model.constructor;
		return _.get(Model, '__aclopts.rel') || this.opts.rel;
	}

	// allowDefaultPermissions(inst) {
	// 	const rel = this.relname(inst);
	// 	assert(inst, g.f('"inst" is required'));
	//
	// 	const Model = inst.constructor;
	// 	const modelName = Model.modelName;
	// 	const ss = Model.security;
	// 	const isGroupModel = this.isGroupModel(inst.constructor);
	//
	// 	let promise;
	// 	let rolesNames;
	// 	if (isGroupModel) {
	// 		rolesNames = Object.keys(ss.roles);
	// 		promise = Promise.resolve(inst);
	// 	} else {
	// 		assert(typeof inst[rel] === 'function', g.f('resource has no relation %s', rel));
	// 		rolesNames = Object.keys(ss.permissions);
	// 		promise = Promise.fromCallback(cb => inst[rel]({}, {skipAccess: true}, cb)).catch(err => {
	// 			if (/Polymorphic model not found/.test(err.message)) {
	// 				return;
	// 			}
	// 			throw err;
	// 		});
	// 	}
	//
	// 	return promise.then(group => {
	// 		if (!group) {
	// 			return debug('allowDefaultPermissions - Skip for no group instance found for %s:%s', modelName, inst.id);
	// 		}
	// 		return this.roles.scoped(group).find({where: {name: {inq: rolesNames}}}).then(roles => {
	// 			const groupModelName = group.constructor.modelName;
	// 			const groupId = group.id;
	// 			if (!roles.length) {
	// 				debug('allowDefaultPermissions - No roles %j found for %s:%s', rolesNames, groupModelName, groupId);
	// 			}
	// 			return Promise.each(roles, role => {
	// 				const actions = _.map(isGroupModel ? ss.roles[role.name].actions : ss.permissions[role.name], _.toUpper);
	// 				debug('allowDefaultPermissions - Allowing %s:%s:%s to access %s:%s with permissions %j', groupModelName, groupId, role.name, modelName, inst.id, actions);
	// 				return this.acl.allow(role, inst, actions);
	// 			});
	// 		});
	// 	}).thenReturn();
	// }

	assignRolesForGroupCreator(inst, userId) {
		const {opts, acl} = this;
		const Model = inst.constructor;
		const modelName = Model.modelName;
		const roles = Object.keys(Model.security.roles);
		debug('assignRolesForGroupCreator - Sure group %s:%s with roles %j', modelName, inst.id, roles);
		return Promise.map(roles, role => acl.scoped(inst).addRole(role)).then(roles => {
			if (userId === null) return;
			userId = userId || inst.userId || inst.owner;
			let promise;
			if (typeof userId === 'function') {
				// Try to follow belongsTo
				const rel = _.find(Model.relations, rel => rel.type === 'belongsTo' && isUserClass(rel.modelTo));
				if (!rel) return;
				promise = Promise.fromCallback(cb => inst[rel.name](cb));
			} else {
				promise = Promise.resolve(userId);
			}

			return promise.then(userId => {
				if (!userId) {
					debug('assignRolesForGroupCreator - No user or creator of group %s:%s found, skip assign roles for creator.', modelName, inst.id);
					return;
				}
				return Promise.filter(roles, role => opts.defaultCreatorRoles.includes(role.name)).then(roles => {
					debug('assignRolesForGroupCreator - Assign user %s to roles %j', userId, _.map(roles, r => r.name));
					return acl.assignRolesUsers(roles, userId);
				});
			});
		});
	}

	//
	// autoupdateGroupsPermissions(pageSize) {
	// 	debug('Auto updating groups permissions');
	// 	const {acl} = this;
	//
	// 	const updateOne = (inst) => {
	// 		const Model = inst.constructor;
	// 		const roles = Object.keys(Model.security.roles);
	// 		return Promise.map(roles, role => acl.scoped(inst).addRole(role))
	// 			.then(this.assignRolesForGroupCreator(inst))
	// 			.then(this.allowDefaultPermissions(inst));
	// 	};
	//
	// 	function update(Model, limit, offset) {
	// 		if (_.isEmpty(Model.security.roles)) {
	// 			return debug('Skip %s auto update permissions for no default roles defined for it', Model.modelName);
	// 		}
	// 		offset = offset || 0;
	// 		const filter = limit ? {limit, offset} : null;
	// 		return Promise.resolve(Model.find(filter, {skipAccess: true})).then(instances => {
	// 			if (_.isEmpty(instances)) return;
	// 			return Promise.map(instances, updateOne).then(() => {
	// 				if (!filter || instances.length < limit) return;
	// 				return update(Model, limit, limit + offset);
	// 			});
	// 		});
	// 	}
	//
	// 	return Promise.each(this.groups, model => update(model, pageSize));
	// }
	//
	// autoupdateResourcesPermissions(pageSize) {
	// 	debug('Auto updating resources permissions');
	// 	const updateOne = (inst) => this.allowDefaultPermissions(inst);
	//
	// 	function update(Model, limit, offset) {
	// 		offset = offset || 0;
	// 		const filter = limit ? {limit, offset} : null;
	// 		return Promise.resolve(Model.find(filter, {skipAccess: true})).then(instances => {
	// 			if (_.isEmpty(instances)) return;
	// 			return Promise.map(instances, updateOne).then(() => {
	// 				if (!filter || instances.length < limit) return;
	// 				return update(Model, limit, limit + offset);
	// 			});
	// 		});
	// 	}
	//
	// 	return Promise.each(this.resources, model => update(model, pageSize));
	// }
	//
	// autoupdatePermissions(pageSize) {
	// 	debug('---------------------------------------------------------------');
	// 	debug('Auto updating permissions %s.', pageSize ? 'with page size ' + chalk.blue(pageSize) : '');
	// 	debug('---------------------------------------------------------------');
	// 	return Promise.each([
	// 		() => this.autoupdateGroupsPermissions(pageSize),
	// 		() => this.autoupdateResourcesPermissions(pageSize)
	// 	], fn => fn()).then(() => {
	// 		debug('---------------------------------------------------------------');
	// 	});
	// }
}

module.exports = Security;

function isUserClass(modelClass) {
	if (!modelClass) return false;
	const User = modelClass.modelBuilder.models.User;
	if (!User) return false;
	return modelClass === User || modelClass.prototype instanceof User;
}

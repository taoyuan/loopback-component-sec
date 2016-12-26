"use strict";

/* eslint max-nested-callbacks: 0 */

const debug = require('debug')('loopback:component:sec:role-resolver');
const _ = require('lodash');
const chalk = require('chalk');
const Promise = require('bluebird');
const util = require('util');
const utils = require('../utils');

/**
 * "__create__products".match(regRelMethod)
 *
 *  >>>
 *
 *  Match #0  Length: 18  Range: 0-17
 *    __create__products
 *  Group #1  Length: 10
 *    __create__
 *  Group #2  Length: 6
 *    create
 *  Group #3  Length: 8
 *    products
 *
 * @type {RegExp}
 */
const regRelMethod = /^(__([^_]+)__)([^_]+)/;

function resolveRemoteMethod(method) {
	const matches = method.match(regRelMethod);
	return matches ? {rel: matches[3], method: matches[2]} : {method};
}

module.exports = function (sec) {
	const {acl, app, opts} = sec;
	const {role} = opts;

	debug(`Registering role resolver for "${role}"`);

	const {registry} = app;
	const Role = registry.getModelByType('Role');

	Role.registerResolver(role, (role, context) => {
		const modelName = context.modelName;
		// const accessType = context.accessType;
		const method = context.method;
		const modelClass = context.model;
		const modelId = context.modelId;
		const userId = context.getUserId();
		const remotingOptions = _.get(context, `remotingContext.args.options`, {});
		const remotingData = _.get(context, `remotingContext.args.data`);

		// model method info
		const mm = chalk.blue(modelName + '.' + method);
		const mmi = chalk.blue(modelName + '.' + method) + ' - ';

		const action = resolveAction(modelClass, method);

		const info = _({role, model: modelName, method, action, userId, modelId})
			.transform((result, v, k) => (result.push(k + ': ' + chalk.blue(v))), []);

		let remotingInfo = '';
		if (remotingData) {
			remotingInfo = 'with remoting data: ' + util.inspect(remotingData, {colors: true, breakLength: Infinity});
		}

		debug(`${mm} -------------------------------------------------------------------------`);
		debug(`${mmi} Hitting role resolver for: %s.%s`, modelName, method);
		debug(`${mmi} Resolving for {%s} %s`, info.join(', '), remotingInfo);

		// No userId is present
		if (!userId) {
			debug(`${mmi} Denied access for anonymous user`);
			return Promise.resolve(false);
		}

		remotingOptions.nsecSecured = true;

		return acl.hasRoles(userId, 'admin').then(isAdmin => {
			if (isAdmin) {
				debug(`${mmi} User ${chalk.red('%s')} is allowed to perform any operation for role ${chalk.red('admin')}`, userId);
				return true;
			}

			return Promise.all([
				getCurrentGroup(context),
				getTargetGroup(context)
			]).then(([current, target]) => {
				if (!current) {
					// No group context was determined, so allow passthrough access.
					debug(`${mmi} Could not find group, skipping ACL check on model ${chalk.blue(modelName)} for method ${chalk.blue.bold(method)}.`);
					return true;
				}

				return Promise.resolve(current.constructor.modelName === sec.opts.userModel && current.id === userId)
					.then(allowed => {
						if (!allowed) {
							debug(`${mmi} Checking %s whether has permission %s in group %j`, userId, action, current);
							return acl.scoped(current).findUserRoles(userId, true).then(roles => acl.can([userId, ...roles], current, action));
						}
					})
					.then(allowed => {
						debug(`${mmi} User %s is %s to perform action %s[%s] in group %s`,
							chalk.magenta.bold(userId),
							chalk.magenta.bold(allowed ? 'allowed' : 'not allowed'),
							chalk.magenta(action),
							chalk.magenta(modelName + '.' + method),
							chalk.magenta(utils.toIdentifyString(current))
						);

						if (!allowed) return false;

						if (target && !_.isEqual(current, target)) {
							return acl.scoped(target).findUserRoles(userId, true)
								.then(roles => acl.can([userId, ...roles], target, action))
								.then(allowed => {
									debug(`${mmi} Attempting save into new target group, User %s is%s allowed in target group %j`, userId, allowed ? '' : ' not', target);
									return allowed;
								});
						}
						return allowed;
					});
			});
		});
	});

	// ----------------------------------------------------------------
	//  Internal Functions
	// ----------------------------------------------------------------

	/**
	 * Resolve method to action for static methods and relation prototype methods
	 *
	 * @param Model
	 * @param method
	 * @return {string}
	 */
	function resolveAction(Model, method) {
		const resolved = resolveRemoteMethod(method);

		let prefix = '';
		if (resolved.rel) {
			const Group = _.get(Model.relations[resolved.rel], 'modelTo');
			if (Group && !sec.isGroupModel(Group)) {
				prefix = Model.modelName + ':';
			}
		}

		return _.toUpper(prefix + sec.getActionForMethod(Model, resolved.method));
	}

	function getCurrentGroup(context) {
		const {rel} = sec.opts;
		const {model, modelName, modelId, method, remotingContext} = context;

		if (sec.isGroupModel(model)) {
			return model.findById(modelId, {}, {secure: false});
		}

		return Promise.resolve().then(() => {
			if (modelId) {
				debug('Fetching current group for model: %s, with id: %s, for method: %s', modelName, modelId, method);

				return model.findById(modelId, {}, {secure: false}).then(inst => {
					if (inst) {
						const group = utils.getGroup(model, rel, inst);
						debug('Determined current group: %j, from model: %s, with id: %s, for method: %s', group, modelName, modelId, method);
						return resolveModelInstance(group);
					}
				});
			}
		}).then(group => {
			if (group) return group;
			if (group = utils.getGroup(model, rel, _.get(remotingContext, 'args.data'))) {
				debug('Determined current group: %j, from remoting incoming data for model %s, for method %s', group, modelName, method);
				return resolveModelInstance(group);
			}
		});
	}

	function getTargetGroup(context) {
		const {rel} = sec.opts;
		const {model, modelName, method, remotingContext} = context;
		const group = utils.getGroup(model, rel, _.get(remotingContext, 'args.data'));
		if (group) {
			debug('Determined target group: %j, from incoming data for model: %s, for method: %s', group, modelName, method);
		}
		return resolveModelInstance(group);
	}

	function resolveModelInstance(data) {
		if (!data) {
			return data;
		}
		if (!_.isObject(data) || _.isNil(data.type) || _.isNil(data.id)) {
			// throw new Error('Invalid parameter, should be {type: String, id: String|Number}: ' + data);
			return Promise.resolve();
		}
		const Model = app.loopback.getModel(data.type);
		if (!Model) {
			throw new Error('Can not find model: ' + data.type);
		}
		return Promise.resolve(Model.findById(data.id, {}, {secure: false}));
	}
};

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
		const mm = chalk.green(modelName + '.' + method);
		const mmi = chalk.green(modelName + '.' + method) + ' - ';

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
					// This allow all creation actions
					// TODO create action check ?
					debug(`${mmi} Could not find group, skipping ACL check on model ${chalk.blue(modelName)} for method ${chalk.blue.bold(method)}.`);
					return true;
				}

				return Promise.resolve(current.constructor.modelName === sec.opts.userModel && current.id === userId)
					.then(allowed => {
						if (!allowed) {
							debug(`${mmi} Checking %s whether has permission %s in group %j`, userId, action, current);
							return acl.scoped(current).findUserRoles(userId, true).then(roles => acl.hasPermission([userId, ...roles], current, action));
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
								.then(roles => acl.hasPermission([userId, ...roles], target, action))
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
			const RelModel = _.get(Model.relations[resolved.rel], 'modelTo');
			if (RelModel && !sec.isGroupModel(RelModel)) {
				prefix = RelModel.modelName + ':';
			}
		}

		return _.toUpper(prefix + sec.getActionForMethod(Model, resolved.method));
	}

	function getCurrentGroup(ctx) {
		const {model, modelName, modelId, method, remotingContext} = ctx;
		const rel = _.get(model, '_aclopts.rel') || sec.opts.rel;

		if (sec.isGroupModel(model)) {
			return modelId && model.findById(modelId, {}, {secure: false});
		}

		return Promise.resolve().then(() => {
			let promise = Promise.resolve();

			if (modelId) {
				debug('Fetching current group for model: %s, with id: %s, for method: %s', modelName, modelId, method);
				promise = promise.then(() => model.findById(modelId, {}, {secure: false}));
			} else {
				const m = model[method];
				if (m && m.get) {
					promise = promise.then(() => m.get(ctx.remotingContext));
				}
			}
			return promise.then(instance => {
				instance = instance || _.get(remotingContext, 'args.data');
				const group = utils.getGroup(model, rel, instance);
				if (group) {
					debug('Determined current group: %j, from remoting incoming data for model %s, for method %s', group, modelName, method);
					return resolveModelInstance(group);
				}
			});
		});
	}

	function getTargetGroup(ctx) {
		const {rel} = sec.opts;
		const {model, modelName, method, remotingContext} = ctx;
		const m = model[method];
		let promise;
		if (m && m.getTarget) {
			promise = Promise.resolve(m.getTarget(ctx.remotingContext));
		} else {
			promise = Promise.resolve(_.get(remotingContext, 'args.data'));
		}
		return promise.then(instance => {
			const group = utils.getGroup(model, rel, instance);
			if (group) {
				debug('Determined target group: %j, from incoming data for model: %s, for method: %s', group, modelName, method);
			}
			return resolveModelInstance(group);
		});
	}

	function resolveModelInstance(group) {
		if (_.isObject(group) && !_.isNil(group.type) && !_.isNil(group.id)) {
			const Model = app.registry.getModel(group.type);
			if (!Model) {
				throw new Error('Can not find model: ' + group.type);
			}
			return Promise.resolve(Model.findById(group.id, {}, {secure: false}));
		}

		return Promise.resolve();
	}
};

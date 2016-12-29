"use strict";

const debug = require('debug')('loopback:component:sec:secure-models');
const g = require('strong-globalize');
const _ = require('lodash');
const chalk = require('chalk');
const utils = require('../utils');

module.exports = function (sec) {
	debug(chalk.yellow('Secure Models'));

	const {acl} = sec;
	const models = sec.models;

	// Filter models
	models.filter(attachAccessObserver);

	// Secure models with row level access control
	models.filter(m => !m.__aclopts || m.__aclopts.rowlevel).forEach(secure);

	function secure(Model) {
		debug('Secure model %s with row level access control', Model.modelName);
		acl.secure(Model);
	}

	function attachAccessObserver(Model) {
		debug('Attaching group filter access observer to %s', Model.modelName);

		const modelName = Model.modelName;
		const mni = chalk.green(modelName);

		Model.observe('access', (ctx, next) => {
			const {options, hookState} = ctx;

			if (options.secure === false || options.skipAccess) {
				debug('%s - Skip filter for options skipAccess has been set as true', mni);
				return next();
			}

			const currentUserId = sec.getCurrentUserId(options);

			if (currentUserId) {
				debug('%s - Filtering access', mni);
			} else {
				debug('%s - Skip filter access for no user attached', mni);
				return next();
			}

			// Do not filter if the request is being made against a single model instance.
			if (_.get(ctx.query, 'where.id')) {
				debug('looking up by id - skipping access filters');
				return next();
			}

			if (!options.nsecSecured) {
				debug('nsec not applied - skipping access filters');
				return next();
			}

			debug('%s filter observe access: query=%s, options=%o, hookState=%o',
				mni, JSON.stringify(ctx.query, null, 4), options, hookState);

			acl.hasRoles(currentUserId, 'admin').then(isAdmin => {
				if (isAdmin) return;

				return buildWhere(currentUserId, ctx.Model, ctx.query.where).then(where => {
					debug('%s - original query: %j', mni, ctx.query);
					if (where) {
						ctx.query.where = _.isEmpty(ctx.query.where) ? where : {and: [ctx.query.where, where]};
					}
					debug('%s - modified query: %s', mni, JSON.stringify(ctx.query, null, 2));
				});
			}).nodeify(next);
		});
	}

	/**
	 * Build a where filter to restrict search results to a users group
	 *
	 * @param {String} userId UserId to build filter for.
	 * @param {Object} Model Model to build filter for,
	 * @param {Object} where Model to build filter for,
	 * @returns {Promise.<*|Object>} A where filter.
	 */
	function buildWhere(userId, Model, where) {
		const rel = sec.relname(Model);
		where = where || {};
		let groupType, groupKey, relKey;
		if (sec.isGroupModel(Model)) {
			groupType = Model.modelName;
			groupKey = Model.getIdName();
		} else if (relKey = utils.getRelKey(Model, rel)) {
			groupType = relKey.keyType || where[relKey.keyTypeWhere];
			groupKey = relKey.keyId;
		} else {
			throw new Error(g.f('ACCESS denied: Model %s has no relation %s to group', Model.modelName, rel));
		}

		const mni = chalk.blue(Model.modelName);
		debug('%s - Group Type: %s, Group Key: %s, Where: %j', mni, groupType, groupKey, where);
		return acl.scoped(groupType).findUserRoleMappings(userId).then(mappings => {
			const answer = {[groupKey]: {inq: _.uniq(_.map(mappings, r => r.scopeId))}};
			// if (relKey.keyTypeWhere) {
			// 	answer[relKey.keyTypeWhere] = groupType;
			// }
			return answer;
		});
	}
};

"use strict";

const debug = require('debug')('loopback:component:gsec:group-level-filter');
const g = require('strong-globalize');
const _ = require('lodash');
const chalk = require('chalk');
const arrify = require('arrify');
const PromiseA = require('bluebird');
const utils = require('../utils');

module.exports = function (sec) {
	debug(chalk.yellow('Setup Group Level Filter'));

	const {acl, app} = sec;

	sec.models.forEach(Model => {
		debug('Attaching group level filter for %s', Model.modelName);

		const modelName = Model.modelName;
		const mni = chalk.green(modelName);

		Model.observe('access', (ctx, next) => {
			const {options, hookState} = ctx;

			if (options.secure === false || options.skipGroupLevelFilter) {
				debug('%s - Skipping group level filter for options skipGroupLevelFilter has been set as true', mni);
				return next();
			}

			const currentUserId = sec.getCurrentUserId(options);

			if (currentUserId) {
				debug('%s - Group level filter', mni);
			} else {
				debug('%s - No user attached, skipping group level filter', mni);
				return next();
			}

			// Do not filter if the request is being made against a single model instance.
			if (_.get(ctx.query, 'where.id')) {
				debug('Looking up by id - skipping group level filters');
				return next();
			}

			if (!options.nsecSecured) {
				debug('nsec role not applied - skipping group level filters');
				return next();
			}

			debug('%s applying group level filter: query=%s, options=%o, hookState=%o',
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
	});

	/**
	 * Build a where filter to restrict search results to a users group
	 *
	 * @param {String} userId UserId to build filter for.
	 * @param {Object} Model Model to build filter for,
	 * @param {Object} where Model to build filter for,
	 * @returns {Promise.<*|Object>} A where filter.
	 */
	function buildWhere(userId, Model, where) {
		const userModel = app.registry.getModelByType('User');
		const relname = sec.relname(Model);
		where = where || {};
		let groupTypeValues, groupIdName, rel;
		if (rel = utils.getRelInfo(Model, relname)) {
			groupIdName = rel.idName;
			groupTypeValues = rel.typeValue || where[rel.typeName];
			if (_.isEmpty(groupTypeValues) && rel.typeName) {
				groupTypeValues = _.get(Model, '_aclopts.polymorphicTypes');
			}
		} else if (sec.isGroupModel(Model)) {
			groupIdName = Model.getIdName();
			groupTypeValues = Model.modelName;
		} else {
			throw new Error(g.f('ACCESS denied: Model %s has no relation %s to group', Model.modelName, relname));
		}

		groupTypeValues = arrify(groupTypeValues);

		const mni = chalk.blue(Model.modelName);
		debug('%s - Group Type Values: %s, Group Id Name: %s, Where: %j', mni, groupTypeValues, groupIdName, where);

		return PromiseA.map(groupTypeValues, groupTypeValue => {
			// deal with user
			const groupModel = app.registry.getModelByType(groupTypeValue);
			if (userModel === groupModel) {
				const where = {[groupIdName]: userId};
				if (rel && rel.typeName) {
					where[rel.typeName] = userModel.modelName;
				}
				return where;
			}
			// deal with group model
			return acl.scoped(groupTypeValue).findMemberships({userId, state: 'active'}).then(mappings => {
				const where = {[groupIdName]: {inq: _(mappings).map(m => m.scopeId).uniq().value()}};
				if (rel && rel.typeName) {
					where[rel.typeName] = groupTypeValue;
				}
				return where;
			});
		}).then(wheres => {
			if (_.isEmpty(wheres)) {
				return;
			} else if (wheres.length === 1) {
				return wheres[0];
			}
			return {or: wheres};
		});
	}
};

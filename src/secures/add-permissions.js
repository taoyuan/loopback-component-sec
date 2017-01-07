"use strict";

const debug = require('debug')('loopback:component:gsec:add-permissions');
const _ = require('lodash');
const g = require('strong-globalize')();
const chalk = require('chalk');

module.exports = function (sec) {
	debug(chalk.yellow('Setup permissions adding observer for group models'));

	const {app} = sec;
	const models = sec.models.filter(m => sec.isGroupModel(m) || _.get(m, '_aclopts.rowlevel') === true);

	models.forEach(attachAfterSaveObserver);

	// ----------------------------------------------------------------
	//  Internal Functions
	// ----------------------------------------------------------------
	function attachAfterSaveObserver(model) {
		const Model = app.registry.getModel(model);

		if (typeof Model.observe !== 'function') return;

		debug(g.f('Attaching Auto Add Permissions Observer to %s', Model.modelName));

		const modelName = Model.modelName;
		const mni = chalk.green(modelName);

		Model.observe('after save', (ctx, next) => {
			// only allow default permission for new instance
			if (!ctx.isNewInstance) {
				return next();
			}

			debug('%s - Allowing default permissions for "%s:%s"', mni, modelName, ctx.instance.id);
			sec.allowDefaultPermissions(ctx.instance, sec.getCurrentUserId(ctx.options)).nodeify(next);
		});
	}
};

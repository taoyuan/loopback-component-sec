"use strict";

const debug = require('debug')('loopback:component:gsec:secure');
const g = require('strong-globalize')();
const _ = require('lodash');
const chalk = require('chalk');

module.exports = function (sec) {
	debug(chalk.yellow('Secure Models'));

	const {acl} = sec;

	// Secure group models and resource models with row level access control
	sec.models.forEach(m => secure(m, _.get(m, '_aclopts.rowlevel') === true || (sec.isGroupModel(m) && !m._aclopts)));

	function secure(Model, rowlevel) {
		debug(g.f('Secure %s with %j', Model.modelName, {rowlevel}));
		acl.secure(Model, {rowlevel});
	}
};

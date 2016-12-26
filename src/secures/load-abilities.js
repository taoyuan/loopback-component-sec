"use strict";

const debug = require('debug')('loopback:component:sec:load-abilities');
const _ = require('lodash');
const Promise = require('bluebird');

module.exports = function (sec) {
	const models = sec.models;
	debug('loading permissions from models: %j', _.map(models, m => m.modelName));
	const {Ability} = sec.app.acl;
	return Promise.map(models, model => {
		const modelName = model.modelName;
		const actions = _.map(model.security.actions, action => _.toUpper(action.name));
		return actions.length && Ability.addActions(modelName, actions).then(ability => {
			if (ability) {
				debug('loaded actions "%s": %j', ability.resource, ability.actions);
			} else {
				debug('failed loading actions "%s": %j', modelName, actions);
			}
		});
	}).then(() => {
		debug('loaded all permissions successfully');
	});
};

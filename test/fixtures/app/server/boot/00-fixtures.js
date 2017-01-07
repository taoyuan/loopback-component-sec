'use strict';

const debug = require('debug')('loopback:component:gsec:fixtures');
const needs = require('needs');
const PromiseA = require('bluebird');
const _ = require('lodash');
const path = require('path');

module.exports = function (app, done) {
	const dir = path.join(__dirname, '../../fixtures');

	app.setupFixtures = () => {
		const setups = needs(dir);
		return PromiseA.mapSeries(_.entries(setups), ([filename, setup]) => {
			if (!setup) {
				return console.log('Skip fixture', filename);
			}
			console.log('Setup fixture', filename);
			if (_.isFunction(setup)) {
				return PromiseA.resolve(setup(app));
			} else {
				const Model = app.models[filename];
				if (!Model) {
					return console.log('Skip fixture', filename);
				}
				return PromiseA.fromCallback(cb => Model.create(setup, cb))
					.catch(err => debug('Error when loading fixtures on startup:', err));
			}
		});
	};

	function cleanup() {
		const ignores = [];
		return PromiseA.mapSeries(_.values(app.models), model => {
			if (model.destroyAll) {
				return PromiseA.fromCallback(cb => model.destroyAll(cb));
			}
			ignores.push(model.modelName);
		}).then(() => {
			if (!_.isEmpty(ignores)) {
				console.warn('Ignore cleanup for model %j', ignores);
			}
		});
	}

	if (app.standalone) {
		cleanup().then(() => app.setupFixtures()).then(done);
	} else {
		done();
	}
};

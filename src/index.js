"use strict";

const SG = require('strong-globalize');
SG.SetRootDir(require('path').join(__dirname, '..'));
const debug = require('debug')('loopback:component:sec');
const Promise = require('bluebird');
const Security = require('./security');

module.exports = function (app, options) {
	debug('initializing component');

	const loopback = app.loopback;
	const loopbackMajor = (loopback && loopback.version && loopback.version.split('.')[0]) || 1;

	if (loopbackMajor < 2) {
		throw new Error('loopback-component-sacl requires loopback 2.0 or newer');
	}

	const sec = app.sec = new Security(app, options);

	if (options.security === false) {
		// disable security
		return;
	}

	sec.$promise = Promise.each([
		require('./secures/build'),
		// require('./secures/load-abilities'),
		require('./secures/role-resolver'),
		require('./secures/secure-models'),
		require('./secures/auto-add-roles'),
		// require('./secures/auto-add-permissions'),
	], fn => fn(sec));
};

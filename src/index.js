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

	if (options.enabled === false) {
		// disable security
		return;
	}

	app.middleware('auth:after', require('./keepuser')(options));

	sec.$promise = Promise.each([
		require('./secures/build'),
		require('./secures/role-resolver'),
		require('./secures/secure-group-level'),
		require('./secures/secure'),
		require('./secures/add-roles'),
		require('./secures/add-permissions')
	], fn => fn(sec));
};

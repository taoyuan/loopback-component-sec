"use strict";

/* eslint max-nested-callbacks: 0 */

const debug = require('debug')('loopback:component:gsec:role-resolver');
const authenticate = require('../authenticate');

module.exports = function (sec) {
	const {app, opts} = sec;
	const {role} = opts;

	debug(`Registering role resolver for "${role}"`);
	const {Role} = app.models;
	Role.registerResolver(role, authenticate(sec));
	Role.registerResolver('$gsec', authenticate(sec));
};

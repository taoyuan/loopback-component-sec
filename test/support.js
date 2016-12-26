"use strict";

const PromiseA = require('bluebird');
const _ = require('lodash');
const path = require('path');
const chai = require('chai');
// chai.use(require('dirty-chai'));
chai.use(require('sinon-chai'));
// require('mocha-sinon');
const request = require('supertest-as-promised');

process.env.SACL_LOG_LEVEL = 'debug';

const app = exports.app = require(fixtures('app/server/server'));

function cleanup() {
	return PromiseA.map(_.values(app.models), model => model.dataSource && model.destroyAll());
}

exports.setup = function () {
	return PromiseA.fromCallback(done => app.setupFixtures(done));
};

exports.teardown = function () {
	return cleanup();
};

exports.fixtures = fixtures;
function fixtures(...args) {
	return path.resolve(__dirname, 'fixtures', ...args);
}

function json(verb, url) {
	return request(app)[verb](url)
		.set('Content-Type', 'application/json')
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/);
}
exports.json = json;

function loginAs(name) {
	return json('post', '/api/accounts/login')
		.send({username: name, password: 'password'})
		.expect(200);
}
exports.loginAs = loginAs;

exports.users = {
	generalUser: {
		username: 'generalUser',
		abilities: []
	},
	userMemberA: {
		username: 'userMemberA',
		abilities: ['read']
	},
	userManagerA: {
		username: 'userManagerA',
		abilities: ['create', 'read', 'update']
	},
	userAdminA: {
		username: 'userAdminA',
		abilities: ['create', 'read', 'update', 'delete']
	}
};

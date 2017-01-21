"use strict";

const PromiseA = require('bluebird');
const _ = require('lodash');
const path = require('path');
const chai = require('chai');
chai.use(require('chai-as-promised')).use(require('sinon-chai'));
const request = require('supertest-as-promised');

process.env.SACL_LOG_LEVEL = 'debug';

const app = exports.app = require(fixtures('app/server/server'));

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

exports.setup = function () {
	return cleanup().then(() => app.setupFixtures());
};

exports.teardown = function () {
	return PromiseA.resolve(); // cleanup();
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
		abilities: ['create', 'read', 'update', 'delete']
	},
	userAdminA: {
		username: 'userAdminA',
		abilities: ['create', 'read', 'update', 'delete']
	}
};

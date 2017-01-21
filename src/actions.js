'use strict';

const _ = require('lodash');

const READ = 'read';
const WRITE = 'write';
const MANAGE = 'manage';

const ACTIONS_TO_METHODS = {
	[READ]: ['exists', 'get', 'find', 'findById', 'findOne', 'count'],
	[WRITE]: ['create', 'updateOrCreate', 'upsertWithWhere', 'upsert', 'patchOrCreate', 'patchAttributes', 'destroyById', 'deleteById', 'removeById'],
	[MANAGE]: [],
};

const METHODS_TO_ACTIONS = _(ACTIONS_TO_METHODS)
	.values()
	.flatten()
	.map(m => [m, _.findKey(ACTIONS_TO_METHODS, acts => acts.includes(m))])
	.fromPairs()
	.value();

function fromMethod(method, defaults) {
	return METHODS_TO_ACTIONS[method] || defaults;
}

module.exports = {
	READ, WRITE, MANAGE,
	ACTIONS_TO_METHODS,
	METHODS_TO_ACTIONS,
	fromMethod
};

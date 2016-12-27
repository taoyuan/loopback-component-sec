'use strict';

const assert = require('chai').assert;
const Actions = require('../src/actions');

describe('actions', () => {
	it('should mapped methods to actions', () => {
		assert.deepEqual(Actions.METHODS_TO_ACTIONS, {
			count: "read",
			create: "write",
			deleteById: "manage",
			destroyById: "manage",
			exists: "read",
			find: "read",
			findById: "read",
			findOne: "read",
			get: "read",
			patchAttributes: "write",
			patchOrCreate: "write",
			removeById: "manage",
			updateOrCreate: "write",
			upsert: "write",
			upsertWithWhere: "write"
		});
	});
});

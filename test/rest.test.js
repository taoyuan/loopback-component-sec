'use strict';

/* eslint max-nested-callbacks: 0 */
const _ = require('lodash');
const PromiseA = require('bluebird');
const path = require('path');
const assert = require('chai').assert;
const request = require('supertest-as-promised');

const s = require('./support');
const {app} = s;

function json(verb, url) {
	return request(app)[verb](url)
		.set('Content-Type', 'application/json')
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/);
}

function logInAs(name) {
	return json('post', '/api/accounts/login')
		.send({username: name, password: 'password'})
		.expect(200);
}

describe('REST API', () => {
	describe('Basic', () => {
		before(s.setup);
		after(s.teardown);

		describe('Role: unauthenticated', () => {
			it('should not allow access to list invoices without access token', () => {
				return json('get', '/api/invoices')
					.expect(401);
			});

			it('should not allow access to a teams invoice without access token', () => {
				return json('get', '/api/invoices/1')
					.expect(401);
			});
		});

		describe('User: Login', () => {
			it('should login using username and password', () => {
				const user = s.users.generalUser;
				return logInAs(user.username)
					.then(res => assert.property(res.body, 'userId', user.username));
			});
		});
	});

	describe('Rest with user authenticated', () => {
		_.values(s.users).forEach(itWithUser);
	});

	describe('Rest with row level access control', () => {
		before(s.setup);
		after(s.teardown);

		it('should get products without group type specified', () => {
			const user = s.users.userMemberA;
			return logInAs(user.username)
				.then(res => json('get', `/api/products?access_token=${res.body.id}`)
					.expect(200))
				.then(res => {
					assert.isArray(res.body);
					assert.lengthOf(res.body, 3);
				});
		});

		it('should get products allowed for non permission restrict', () => {
			const user = s.users.userMemberA;
			return logInAs(user.username)
				.then(res => json('get', `/api/products?filter[where][ownerType]=Store&access_token=${res.body.id}`)
					.expect(200))
				.then(res => {
					assert.isArray(res.body);
					assert.lengthOf(res.body, 2);
					assert.property(res.body[0], 'name', 'ProductA1');
				});
		});

		it('should get all products allowed for permission restrict', () => {
			const user = s.users.userManagerA;
			return logInAs(user.username)
				.then(res => json('get', `/api/products?filter[where][ownerType]=Store&access_token=${res.body.id}`)
					.expect(200))
				.then(res => {
					assert.isArray(res.body);
					assert.lengthOf(res.body, 2);
					assert.property(res.body[0], 'name', 'ProductA1');
					assert.property(res.body[1], 'name', 'ProductA2');
				});
		});

		it('should get all products allowed for parent roles', () => {
			const user = s.users.userAdminA;
			return logInAs(user.username)
				.then(res => json('get', `/api/products?filter[where][ownerType]=Store&access_token=${res.body.id}`)
					.expect(200))
				.then(res => {
					assert.isArray(res.body);
					assert.lengthOf(res.body, 2);
					assert.property(res.body[0], 'name', 'ProductA1');
					assert.property(res.body[1], 'name', 'ProductA2');
				});
		});

		it('should get all product include private product with owner account', () => {
			const user = s.users.userMemberA;
			return logInAs(user.username)
				.then(res => json('get', `/api/products?access_token=${res.body.id}`)
					.expect(200))
				.then(res => {
					assert.isArray(res.body);
					assert.lengthOf(res.body, 3);
				});
		});
	});

	describe('Rest with create group', () => {
		before(s.setup);
		after(s.teardown);

		it('should add default roles and assign current user to admin role', () => {
			const {acl} = app.sec;
			const user = s.users.userAdminA;
			return logInAs(user.username)
				.then(res => json('post', `/api/stores?access_token=${res.body.id}`)
					.send({id: 'C', name: 'Store C'})
					.expect(200))
				.then(res => {
					const scoped = acl.scoped('Store:' + res.body.id);
					return PromiseA.each([
						// Check whether default roles has been added for group model
						() => scoped.findRoles().then(roles => {
							assert.lengthOf(roles, 3);
							assert.sameDeepMembers(roles.map(r => r.name), ['member', 'manager', 'admin']);
						}),
						// Check whether creator has been added to admin role
						() => assert.eventually.isTrue(scoped.hasRoles('userAdminA', 'admin')),
					], fn => fn());
				});
		});
	});
});

function itWithUser(user) {
	describe(`${user.username} (User with ${user.abilities.join(', ')} permissions):`, () => {
		before(s.setup);
		after(s.teardown);

		// related group content
		describe('group model', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should get a teams store', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/stores/A?access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'name', 'Store A');
						});
				});
			}
			it('should not get another teams store', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/stores/B?access_token=${res.body.id}`)
						.expect(401));
			});
		});

		// related group content
		describe('related group content', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should fetch an invoices related transactions from the same team', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/1/transactions?access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 2);
							assert.property(res.body[0], 'id', 1);
							assert.property(res.body[1], 'id', 2);
						});
				});
			}
			it('should not fetch an invoice via a relationship from another teams transaction', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/transactions/3/invoice?access_token=${res.body.id}`)
						.expect(401));
			});
		});
		// end related group content
		// exists
		describe('exists', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should check if a teams invoice exists by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/1/exists?&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body, 'object');
							assert.property(res.body, 'exists', true);
						});
				});
			} else {
				it('should not check if a teams invoice exists by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/1/exists?access_token=${res.body.id}`)
							.expect(401));
				});
			}
			it('should not check if another teams invoice exists by group id', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices/2/exists?access_token=${res.body.id}`)
						.expect(401));
			});
			it('should return false when checking for existance of a invoice that doesnt exist', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices/unknown-id/exists?access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isObject(res.body, 'object');
						assert.property(res.body, 'exists', false);
					});
			});
		});
		// end exists
		// count
		describe('count', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should count a teams invoices by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/count?where[storeId]=A&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 2);
						});
				});
			} else {
				it('should not find a teams invoices by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/count?where[storeId]=A&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 0);
						});
				});
			}
			it('should not count another teams invoices by group id', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices/count?where[storeId]=B&access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isObject(res.body);
						assert.property(res.body, 'count', 0);
					});
			});

			if (_.includes(user.abilities, 'read')) {
				it('should count a teams invoices by invoiceNumber', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/count?where[invoiceNumber]=1&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 1);
						});
				});
			} else {
				it('should not count a teams invoices by invoiceNumber', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/count?where[invoiceNumber]=1&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 0);
						});
				});
			}
			it('should not count another teams invoices by invoiceNumber', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices/count?where[invoiceNumber]=2&access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isObject(res.body);
						assert.property(res.body, 'count', 0);
					});
			});

			const filter = JSON.stringify({
				and: [{
					status: 'active'
				}, {
					storeId: {
						inq: ['A', 'B']
					}
				}]
			});

			if (_.includes(user.abilities, 'read')) {
				it('should limit count results to a teams invoices with a complex filter', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/count?where=${filter}&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 1);
						});
				});
			} else {
				it('should limit count results to a teams invoices with a complex filter', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/count?where=${filter}&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 0);
						});
				});
			}
		});
		// end count

		// find
		describe('find', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should find a teams invoices', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 2);
							assert.property(res.body[0], 'invoiceNumber', 1);
							assert.property(res.body[1], 'invoiceNumber', 3);
						});
				});
				it('should find a teams invoices by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][storeId]=A&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 2);
							assert.property(res.body[0], 'invoiceNumber', 1);
							assert.property(res.body[1], 'invoiceNumber', 3);
						});
				});
			} else {
				it('should not find a teams invoices', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 0);
						});
				});
				it('should not find a teams invoices by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][storeId]=A&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 0);
						});
				});
			}
			it('should not find another teams invoices by group id', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices?filter[where][storeId]=B&access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isArray(res.body);
						assert.lengthOf(res.body, 0);
					});
			});

			if (_.includes(user.abilities, 'read')) {
				it('should find a teams invoices by invoiceNumber', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][invoiceNumber]=1&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 1);
							assert.property(res.body[0], 'invoiceNumber', 1);
						});
				});
			} else {
				it('should not find a teams invoices by invoiceNumber', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][invoiceNumber]=1&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 0);
						});
				});
			}
			it('should not find another teams invoices by invoiceNumber', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices?filter[where][invoiceNumber]=2&access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isArray(res.body);
						assert.lengthOf(res.body, 0);
					});
			});

			const filter = JSON.stringify({
				where: {
					and: [{
						status: 'active'
					}, {
						storeId: {
							inq: ['A', 'B']
						}
					}]
				}
			});

			if (_.includes(user.abilities, 'read')) {
				it('should limit find results to a teams invoices with a complex filter', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter=${filter}&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 1);
							assert.property(res.body[0], 'invoiceNumber', 1);
						});
				});
			} else {
				it('should limit find results to a teams invoices with a complex filter', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter=${filter}&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 0);
						});
				});
			}
		});
		// end find

		// findById
		describe('findById', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should get a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/1?access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'invoiceNumber', 1);
						});
				});
			} else {
				it('should not get a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices/1?access_token=${res.body.id}`)
							.expect(401));
				});
			}

			it('should not get another teams invoice', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices/2?access_token=${res.body.id}`)
						.expect(401));
			});

			it('should return a 404 when getting a invoice that doesnt exist', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices/unknown-id?access_token=${res.body.id}`)
						.expect(404));
			});
		});
		// end findById

		// findOne
		describe('findOne', () => {
			if (_.includes(user.abilities, 'read')) {
				it('should find a teams invoice by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][storeId]=A&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 2);
							assert.property(res.body[0], 'invoiceNumber', 1);
							assert.property(res.body[1], 'invoiceNumber', 3);
						});
				});
			} else {
				it('should not find a teams invoice by group id', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][storeId]=A&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 0);
						});
				});
			}

			it('should not find another teams invoice by group id', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices?filter[where][storeId]=B&access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isArray(res.body);
						assert.lengthOf(res.body, 0);
					});
			});

			if (_.includes(user.abilities, 'read')) {
				it('should find a teams invoice by invoiceNumber', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][invoiceNumber]=1&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 1);
							assert.property(res.body[0], 'invoiceNumber', 1);
						});
				});
			} else {
				it('should not find a teams invoice by invoiceNumber', () => {
					return logInAs(user.username)
						.then(res => json('get', `/api/invoices?filter[where][invoiceNumber]=1&access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isArray(res.body);
							assert.lengthOf(res.body, 0);
						});
				});
			}

			it('should not find another teams invoice by invoiceNumber', () => {
				return logInAs(user.username)
					.then(res => json('get', `/api/invoices?filter[where][invoiceNumber]=2&access_token=${res.body.id}`)
						.expect(200))
					.then(res => {
						assert.isArray(res.body);
						assert.lengthOf(res.body, 0);
					});
			});
		});
		// end findOne

		// create
		describe('create', () => {
			let invoiceId = null;

			if (_.includes(user.abilities, 'create')) {
				it('should create a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('post', `/api/invoices?access_token=${res.body.id}`)
							.send({storeId: 'A', invoiceNumber: 100})
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'invoiceNumber', 100);
							invoiceId = res.body.id;
						});
				});
			} else {
				it('should not create a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('post', `/api/invoices?access_token=${res.body.id}`)
							.send({storeId: 'A', name: 'A invoice'})
							.expect(401));
				});
			}

			it('should not create another teams invoice', () => {
				return logInAs(user.username)
					.then(res => json('post', `/api/invoices?access_token=${res.body.id}`)
						.send({storeId: 'B', name: 'A invoice'})
						.expect(401));
			});

			after(() => {
				if (invoiceId) {
					return app.models.Invoice.destroyById(invoiceId);
				}
				return null;
			});
		});
		// end create

		// upsert
		describe('upsert', () => {
			if (_.includes(user.abilities, 'update')) {
				it('should update a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/invoices?access_token=${res.body.id}`)
							.send({
								id: 1,
								storeId: 'A',
								invoiceNumber: 1,
								someprop: 'someval'
							})
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'someprop', 'someval');
						});
				});
				it('should not reassign a invoice to another team', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/invoices?access_token=${res.body.id}`)
							.send({
								id: 1,
								storeId: 'B',
								invoiceNumber: 1,
								someprop: 'someval'
							})
							.expect(401));
				});
			} else {
				it('should not update a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/invoices?access_token=${res.body.id}`)
							.send({
								id: 1,
								storeId: 'A',
								invoiceNumber: 1,
								someprop: 'someval'
							})
							.expect(401));
				});
			}
			it('should not update another teams invoice', () => {
				return logInAs(user.username)
					.then(res => json('patch', `/api/invoices?access_token=${res.body.id}`)
						.send({
							id: 2,
							storeId: 'B',
							invoiceNumber: 1,
							someprop: 'someval'
						})
						.expect(401));
			});
			it('should not reassign another teams invoice to our team', () => {
				return logInAs(user.username)
					.then(res => json('patch', `/api/invoices?access_token=${res.body.id}`)
						.send({
							id: 2,
							storeId: 'A',
							invoiceNumber: 2,
							someprop: 'someval'
						})
						.expect(401));
			});
		});
		// end upsert

		// updateAttributes
		describe('updateAttributes', () => {
			if (_.includes(user.abilities, 'update')) {
				it('should update a teams invoice attributes', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/invoices/1?access_token=${res.body.id}`)
							.send({someprop: 'someval'})
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'someprop', 'someval');
						});
				});
				it('should not reassign a invoice to another team', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/invoices/1?access_token=${res.body.id}`)
							.send({storeId: 'B'})
							.expect(401));
				});
			} else {
				it('should update a teams invoice attributes with 401 return', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/invoices/1?access_token=${res.body.id}`)
							.send({someprop: 'someval'})
							.expect(401));
				});
			}

			it('should not update another teams invoice attributes', () => {
				return logInAs(user.username)
					.then(res => json('patch', `/api/invoices/2?access_token=${res.body.id}`)
						.send({someprop: 'someval'})
						.expect(401));
			});
			it('should not reassign another teams invoice to our team', () => {
				return logInAs(user.username)
					.then(res => json('patch', `/api/invoices/2?access_token=${res.body.id}`)
						.send({storeId: 'A'})
						.expect(401));
			});
		});
		// end updateAttributes

		// destroyById
		describe('destroyById', () => {
			if (_.includes(user.abilities, 'delete')) {
				it('should delete a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('delete', `/api/invoices/1?access_token=${res.body.id}`)
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
							assert.property(res.body, 'count', 1);
						});
				});
			} else {
				it('should not delete a teams invoice', () => {
					return logInAs(user.username)
						.then(res => json('delete', `/api/invoices/1?access_token=${res.body.id}`)
							.expect(401));
				});
			}
			it('should not delete another teams invoice', () => {
				return logInAs(user.username)
					.then(res => json('delete', `/api/invoices/2?access_token=${res.body.id}`)
						.expect(401));
			});
		});
		// end destroyById,

		// custom model instance get
		describe('custom model instance get', () => {
			if (_.includes(user.abilities, 'update')) {
				it('should edit a product', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/products/A/ProductA1?access_token=${res.body.id}`)
							.send({data: {description: 'Test product'}})
							.expect(200))
						.then(res => {
							assert.isObject(res.body);
						});
				});
			} else {
				it('should not edit a product', () => {
					return logInAs(user.username)
						.then(res => json('patch', `/api/products/A/ProductA1?access_token=${res.body.id}`)
							.send({data: {description: 'Test product'}})
							.expect(401));
				});
			}

			it('should not edit another product', () => {
				return logInAs(user.username)
					.then(res => json('patch', `/api/products/B/ProductB1?access_token=${res.body.id}`)
						.send({data: {description: 'Test product'}})
						.expect(401));
			});
		});
		// end custom model instance get
	});
}

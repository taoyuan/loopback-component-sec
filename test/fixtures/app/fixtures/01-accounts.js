const PromiseA = require('bluebird');
const _ = require('lodash');

const data = [
	{
		id: "admin",
		username: "admin",
		email: "admin@example.com",
		password: "password"
	},
	{
		id: "generalUser",
		username: "generalUser",
		email: "generalUser@example.com",
		password: "password"
	},
	{
		id: "userAdminA",
		username: "userAdminA",
		email: "userAdminA@example.com",
		password: "password"
	},
	{
		id: "userManagerA",
		username: "userManagerA",
		email: "userManagerA@example.com",
		password: "password"
	},
	{
		id: "userMemberA",
		username: "userMemberA",
		email: "userMemberA@example.com",
		password: "password"
	},
	{
		id: "userAdminB",
		username: "userAdminB",
		email: "userAdminB@example.com",
		password: "password"
	},
	{
		id: "userManagerB",
		username: "userManagerB",
		email: "userManagerB@example.com",
		password: "password"
	},
	{
		id: "userMemberB",
		username: "userMemberB",
		email: "userMemberB@example.com",
		password: "password"
	}
];

module.exports = function (app) {
	const {Account} = app.models;
	return PromiseA.map(data, item => Account.create(item)).then(users => {
		app.users = _.fromPairs(_.map(users, user => [user.username, user]));
	});
};

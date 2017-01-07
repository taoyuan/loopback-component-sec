const PromiseA = require('bluebird');

const data = [
	{
		id: "tokenAdmin",
		userId: "admin"
	},
	{
		id: "tokenUser",
		userId: "generalUser"
	},
	{
		id: "tokenAdminA",
		userId: "userAdminA"
	},
	{
		id: "tokenManagerA",
		userId: "userManagerA"
	},
	{
		id: "tokenMemberA",
		userId: "userMemberA"
	},
	{
		id: "tokenAdminB",
		userId: "userAdminB"
	},
	{
		id: "tokenManagerB",
		userId: "userManagerB"
	},
	{
		id: "tokenMemberB",
		userId: "userMemberB"
	}
];

module.exports = function (app) {
	const {AccessToken} = app.models;
	return PromiseA.fromCallback(cb => AccessToken.create(data, cb));
};

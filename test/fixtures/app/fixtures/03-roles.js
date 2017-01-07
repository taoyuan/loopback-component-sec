const PromiseA = require('bluebird');

const data = [
	{
		id: "admin",
		name: "admin",
		scope: null
	},
	{
		id: "roleAdminA",
		name: "admin",
		scope: "Store",
		scopeId: "A",
		parentIds: [
			"roleManagerA"
		]
	},
	{
		id: "roleManagerA",
		name: "manager",
		scope: "Store",
		scopeId: "A",
		parentIds: [
			"roleMemberA"
		]
	},
	{
		id: "roleMemberA",
		name: "member",
		scope: "Store",
		scopeId: "A"
	},
	{
		id: "roleAdminB",
		name: "admin",
		scope: "Store",
		scopeId: "B",
		parentIds: [
			"roleManagerB"
		]
	},
	{
		id: "roleManagerB",
		name: "manager",
		scope: "Store",
		scopeId: "B",
		parentIds: [
			"roleMemberB"
		]
	},
	{
		id: "roleMemberB",
		name: "member",
		scope: "Store",
		scopeId: "B"
	}
];

module.exports = function (app) {
	const {SecRole} = app.models;
	return PromiseA.fromCallback(cb => SecRole.create(data, cb));
};

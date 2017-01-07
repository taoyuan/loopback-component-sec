const PromiseA = require('bluebird');

const data = [
	{
		id: "ProductA1",
		name: "ProductA1",
		ownerType: "Store",
		ownerId: "A"
	},
	{
		id: "ProductA2",
		name: "ProductA2",
		ownerType: "Store",
		ownerId: "A",
		_permissions: [
			{
				subject: "SecRole:roleManagerA",
				actions: [
					"WRITE"
				]
			}
		]
	},
	{
		id: "ProductB1",
		name: "ProductB1",
		ownerType: "Store",
		ownerId: "B"
	},
	{
		id: "ProductB2",
		name: "ProductB2",
		ownerType: "Store",
		ownerId: "B"
	},
	{
		id: "ProductPrivate",
		name: "ProductPrivate",
		ownerType: "Account",
		ownerId: "userMemberA"
	}
];

module.exports = function (app) {
	const {Product} = app.models;
	return PromiseA.fromCallback(cb => Product.create(data, cb));
};

const PromiseA = require('bluebird');

const data = [
	{
		id: "1",
		invoiceNumber: 1,
		storeId: "A",
		status: "active"
	},
	{
		id: "2",
		invoiceNumber: 2,
		storeId: "B",
		status: "active"
	},
	{
		id: "3",
		invoiceNumber: 3,
		storeId: "A",
		status: "disabled"
	},
	{
		id: "4",
		invoiceNumber: 4,
		storeId: "B",
		status: "disabled"
	}
];

module.exports = function (app) {
	const {Invoice} = app.models;
	return PromiseA.fromCallback(cb => Invoice.create(data, cb));
};

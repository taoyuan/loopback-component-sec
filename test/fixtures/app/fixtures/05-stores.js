const PromiseA = require('bluebird');

const data = [
	{
		id: "A",
		name: "Store A"
	},
	{
		id: "B",
		name: "Store B"
	}
];

module.exports = function (app) {
	const {Store} = app.models;
	return PromiseA.fromCallback(cb => Store.create(data, cb));
};

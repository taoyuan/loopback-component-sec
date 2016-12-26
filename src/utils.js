"use strict";

const _ = require('lodash');

exports.getRelKey = function (Model, rel) {
	const relation = Model.relations[rel];

	if (!relation) return;

	if (relation.polymorphic) {
		const {discriminator, foreignKey} = relation.polymorphic;
		return {
			keyId: foreignKey,
			keyTypeWhere: discriminator
		};
	} else {
		return {
			keyType: relation.modelTo && relation.modelTo.modelName,
			keyId: relation.keyFrom
		};
	}
};

exports.getGroup = function (Model, rel, data) {
	if (!data) return;

	const relation = Model.relations[rel];

	if (!relation) return;

	let type;
	let id;

	if (relation.polymorphic) {
		const {discriminator, foreignKey} = relation.polymorphic;
		type = data[discriminator];
		id = data[foreignKey];

		if (!type && data[rel]) {
			if (typeof data[rel] === 'string') {
				const parts = _.split(data[rel], ':');
				type = parts[0];
				id = parts[1];
			} else if (typeof data[rel] === 'object') {
				type = data[rel].type;
				id = data[rel].id;
			}
		}
	} else {
		type = relation.modelTo && relation.modelTo.modelName;
		id = data[relation.keyFrom];
	}

	if (!type) return;

	return {type, id};
};

exports.wrapGroup = function (owner) {
	if (owner && owner.type) {
		// owner.type could be Model
		const type = _.get(owner.type, 'modelName') || owner.type;
		return type + (_.isNil(owner.id) ? '' : ':' + owner.id);
	}
};

exports.unwrapGroup = function (data) {
	const parts = _.split(data, ':');
	return {type: parts[0], id: parts[1]};
};

exports.toModelsNames = function (models) {
	return _.map(models, model => typeof model === 'function' ? model.modelName : model);
};

exports.sureArray = function (value) {
	if (_.isNil(value)) return [];
	if (!Array.isArray(value)) return [value];
	return value;
};

exports.toIdentifyString = function (obj) {
	if (!obj) return '';
	if (!_.isObject(obj)) return obj;

	const type = _.isString(obj.type) ? obj.type : obj.constructor.modelName;
	return type + (obj.id ? ':' + obj.id : '');
};

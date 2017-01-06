'use strict';

module.exports = function (Product) {
	/* eslint-skip-next-line */
	Product.edit = (owner, name, data, options) => {
		return get(owner, name).then(prod => {
			if (!prod) throw new Error('No production found');
			return prod.updateAttributes(data, options);
		});
	};
	Product.edit.get = (ctx) => {
		const {owner, prod} = ctx.args;
		return get(owner, prod);
	};

	function get(owner, name) {
		return Product.findOne({where: {ownerId: owner, name}});
	}

	Product.remoteMethod('edit', {
		description: 'Edit a product',
		accessType: 'WRITE',
		accepts: [
			{
				arg: 'owner', type: 'string', required: true, http: {source: 'path'},
				description: 'Owner id or name'
			},
			{
				arg: 'prod', type: 'string', required: true, http: {source: 'path'},
				description: 'Repository id or name'
			},
			{
				arg: 'data', type: 'object', required: true,
				description: 'Repository properties'
			},
			{arg: 'options', type: 'object', http: 'optionsFromRequest'},
		],
		returns: {arg: 'data', type: 'object', root: true},
		http: {verb: 'patch', path: '/:owner/:prod'},
	});

	return Product;
};

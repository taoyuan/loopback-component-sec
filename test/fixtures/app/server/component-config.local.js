const path = require('path');

let fixturesPath = path.relative(process.cwd(), path.resolve(__dirname, "../fixtures"));
if (fixturesPath[fixturesPath.length - 1] !== '/') {
	fixturesPath += '/';
}

/* eslint-disable */
module.exports = {
	"loopback-component-fixtures": {
		"fixturesPath": fixturesPath
	}
};

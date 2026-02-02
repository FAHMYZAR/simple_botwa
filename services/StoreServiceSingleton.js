const StoreService = require('./StoreService');

let instance = global.__STORE_SERVICE__;

if (!instance) {
	instance = new StoreService();
	global.__STORE_SERVICE__ = instance;
}

module.exports = instance;

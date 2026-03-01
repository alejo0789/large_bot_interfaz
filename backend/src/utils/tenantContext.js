const { AsyncLocalStorage } = require('async_hooks');

// Create a context that will store the tenant database pool for the current request
const tenantContext = new AsyncLocalStorage();

module.exports = {
    tenantContext
};

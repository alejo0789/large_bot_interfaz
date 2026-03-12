const { Pool } = require('pg');
const { tenantContext } = require('../utils/tenantContext');

/**
 * Multi-Tenant Database Manager
 * Manages a cache of connection pools for different sites
 */
class MultiTenantManager {
    constructor() {
        this.pools = new Map();
        // Master connection configuration
        // Prefer MASTER_DATABASE_URL (Neon cloud) over individual local vars
        const masterUrl = process.env.MASTER_DATABASE_URL;
        const masterConfig = masterUrl
            ? {
                connectionString: masterUrl,
                ssl: (masterUrl.includes('localhost') || masterUrl.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
            }
            : {
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'root',
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'chatbot_master'
            };

        console.log(`📡 Initializing Master Database Connection: ${masterUrl ? '(Neon) chatbot_master' : `${masterConfig.host}:${masterConfig.port}/${masterConfig.database}`}`);

        this.masterPool = new Pool(masterConfig);

        // Force public schema — Neon sometimes has a different default search_path
        this.masterPool.on('connect', async (client) => {
            await client.query("SET search_path = public");
        });

        this.masterPool.on('error', (err) => {
            console.error('Unexpected error on master database pool', err);
        });
    }

    /**
     * Get or create a connection pool for a specific tenant
     * @param {string} tenantId - The UUID or slug of the tenant
     * @param {string} connectionString - The full DB connection URL
     */
    async getPool(tenantId, connectionString) {
        if (this.pools.has(tenantId)) {
            return this.pools.get(tenantId);
        }

        console.log(`📡 Creating new connection pool for tenant: ${tenantId}`);
        // Ensure connectionString is valid or fallback to local if same host but different DB
        const pool = new Pool({
            connectionString: connectionString,
            ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
            min: 2,
            max: 20,
            idleTimeoutMillis: 30000
        });

        // Set UTF-8 encoding on each connection
        pool.on('connect', async (client) => {
            try {
                await client.query("SET client_encoding = 'UTF8'");
            } catch (err) {
                console.error(`Error setting encoding for ${tenantId}:`, err);
            }
        });

        pool.on('error', (err) => {
            console.error(`Unexpected error on idle client for ${tenantId}`, err);
        });

        this.pools.set(tenantId, pool);
        return pool;
    }

    /**
     * Legacy Test connection (for master)
     */
    async testConnection() {
        try {
            const client = await this.masterPool.connect();
            console.log('✅ Master Database connected successfully');
            client.release();
            return true;
        } catch (err) {
            console.error('❌ Master Database connection failed:', err.message);
            return false;
        }
    }
}

const dbManager = new MultiTenantManager();

/**
 * DATABASE POOL PROXY
 * This is the magic: it returns the tenant-specific pool if we are inside a 
 * tenant request context (via tenantMiddleware), otherwise falls back to masterPool.
 * 
 * This allows all existing services to continue using `require('../config/database').pool`
 * without modification while becoming multi-tenant aware.
 */
const poolProxy = new Proxy({}, {
    get: (target, prop) => {
        // Try to get the pool from the current request context
        const context = tenantContext.getStore();

        if (!context || !context.db) {
            // Only log if it's not a generic property check or internal node thing
            if (typeof prop === 'string' && !['then', 'inspect', 'toString', 'valueOf'].includes(prop)) {
                // If we are in a request where we expected a tenant but context is missing
                // This is a sign of AsyncLocalStorage losing context
                // console.warn(`⚠️ [DB PROXY] No tenant context found for property: ${prop}. Falling back to Master DB.`);
            }
            return dbManager.masterPool[prop];
        }

        const activePool = context.db;
        const value = activePool[prop];
        if (typeof value === 'function') {
            return value.bind(activePool);
        }
        return value;
    }
});

module.exports = {
    pool: poolProxy, // Dynamic proxy
    dbManager,
    testConnection: () => dbManager.testConnection()
};

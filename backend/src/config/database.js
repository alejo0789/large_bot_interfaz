/**
 * Database Configuration
 * Handles PostgreSQL connection pool with UTF-8 support
 * Supports Neon, Railway, and local PostgreSQL
 */
const { Pool } = require('pg');

// Check if we have a DATABASE_URL (Neon, Railway, etc.)
const DATABASE_URL = process.env.DATABASE_URL;

// Configure pool based on environment
let poolConfig;

if (DATABASE_URL) {
    // Use connection string directly (works with Neon, Railway, etc.)
    poolConfig = {
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Neon
        },
        // =============================================
        // OPTIMIZED FOR 2000+ CONVERSATIONS
        // =============================================
        min: 5,                        // Minimum connections to keep ready
        max: 50,                       // Maximum connections (increased from 20)
        idleTimeoutMillis: 60000,      // Close idle connections after 1 minute
        connectionTimeoutMillis: 10000, // Wait up to 10s for a connection
        acquireTimeoutMillis: 30000,   // Wait up to 30s to acquire from pool
        statement_timeout: 30000,      // Kill queries running longer than 30s
    };
    console.log('📡 Using DATABASE_URL for connection (pool: 5-50)');
} else {
    // Use individual environment variables (local development)
    poolConfig = {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'root',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'chatbot_db',
        ssl: false,
        // =============================================
        // OPTIMIZED FOR 2000+ CONVERSATIONS
        // =============================================
        min: 2,                        // Minimum connections for local dev
        max: 50,                       // Maximum connections (increased from 20)
        idleTimeoutMillis: 60000,      // Close idle connections after 1 minute
        connectionTimeoutMillis: 5000, // Wait up to 5s for a connection
        acquireTimeoutMillis: 15000,   // Wait up to 15s to acquire from pool
    };
    console.log('🏠 Using local database configuration (pool: 2-50)');
}

const pool = new Pool(poolConfig);

// Set UTF-8 encoding on each connection
pool.on('connect', async (client) => {
    try {
        await client.query("SET client_encoding = 'UTF8'");
    } catch (err) {
        console.error('Error setting encoding:', err);
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Test connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    }
};

module.exports = { pool, testConnection };

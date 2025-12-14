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
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    };
    console.log('📡 Using DATABASE_URL for connection');
} else {
    // Use individual environment variables (local development)
    poolConfig = {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'root',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'chatbot_db',
        ssl: false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
    console.log('🏠 Using local database configuration');
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

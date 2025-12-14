/**
 * Database Configuration
 * Handles PostgreSQL connection pool with UTF-8 support
 */
const { Pool } = require('pg');

// Parse DATABASE_URL to get components
const parseDbUrl = (url) => {
    if (!url) return null;
    const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);
    if (match) {
        return {
            user: match[1],
            password: match[2],
            host: match[3],
            port: parseInt(match[4]),
            database: match[5]
        };
    }
    return null;
};

const dbConfig = parseDbUrl(process.env.DATABASE_URL);

const pool = new Pool({
    user: dbConfig?.user || process.env.DB_USER || 'postgres',
    password: dbConfig?.password || process.env.DB_PASSWORD || 'root',
    host: dbConfig?.host || process.env.DB_HOST || 'localhost',
    port: dbConfig?.port || process.env.DB_PORT || 5432,
    database: dbConfig?.database || process.env.DB_NAME || 'chatbot_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

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

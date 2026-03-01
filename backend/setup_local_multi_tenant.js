/**
 * Local Multi-Tenant Setup
 * This script creates the master database and two sample tenant databases locally.
 */
const { Client } = require('pg');
require('dotenv').config();

const adminConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres' // Connect to default to create others
};

async function setup() {
    const client = new Client(adminConfig);
    await client.connect();

    try {
        console.log('🏗️  Creating Local Databases...');

        // Create Master DB
        try { await client.query('CREATE DATABASE chatbot_master'); } catch (e) { }
        // Create Tenant A DB
        try { await client.query('CREATE DATABASE chatbot_sede_a'); } catch (e) { }
        // Create Tenant B DB
        try { await client.query('CREATE DATABASE chatbot_sede_b'); } catch (e) { }

        console.log('✅ Local databases created.');
    } catch (err) {
        console.error('❌ Error during setup:', err);
    } finally {
        await client.end();
    }
}

setup();

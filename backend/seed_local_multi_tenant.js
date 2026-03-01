/**
 * Seed Local Databases
 * Replicates the schema to the new databases.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'root';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;

async function seedDB(dbName, sqlFile) {
    const client = new Client({
        user: dbUser,
        password: dbPassword,
        host: dbHost,
        port: dbPort,
        database: dbName
    });

    await client.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, sqlFile), 'utf8');
        await client.query(sql);
        console.log(`✅ Seeded ${dbName} using ${sqlFile}`);
    } catch (err) {
        console.error(`❌ Error seeding ${dbName}:`, err.message);
    } finally {
        await client.end();
    }
}

async function runSeeds() {
    // Seed Master
    await seedDB('chatbot_master', 'master_schema.sql');
    // Seed Tenants (using original schema)
    await seedDB('chatbot_sede_a', 'schema.sql');
    await seedDB('chatbot_sede_b', 'schema.sql');

    // Custom seed for Master to link tenants
    const masterClient = new Client({ user: dbUser, password: dbPassword, host: dbHost, port: dbPort, database: 'chatbot_master' });
    await masterClient.connect();
    try {
        // Insert tenants into master
        await masterClient.query(`
            INSERT INTO tenants (name, slug, db_url) VALUES 
            ('Sede Medellín', 'medellin', 'postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/chatbot_sede_a'),
            ('Sede Bogotá', 'bogota', 'postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/chatbot_sede_b')
            ON CONFLICT DO NOTHING
        `);
        console.log('✅ Registered tenants in Master DB');
    } finally {
        await masterClient.end();
    }
}

runSeeds();

/**
 * Create Admin Script
 * Generates an initial Super Admin in the master database.
 */
const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

const SALT_ROUNDS = 10;
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'chatbot_master'
};

async function createAdmin() {
    const client = new Client(dbConfig);
    await client.connect();

    try {
        const username = 'admin';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await client.query(`
            INSERT INTO users (username, password_hash, full_name, role) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (username) DO NOTHING
        `, [username, hashedPassword, 'Super Admin', 'SUPER_ADMIN']);

        console.log(`✅ Super Admin created: ${username} / ${password}`);
    } catch (err) {
        console.error('❌ Error creating admin:', err);
    } finally {
        await client.end();
    }
}

createAdmin();

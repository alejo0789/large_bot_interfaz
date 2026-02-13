/**
 * Script para verificar la estructura de la tabla messages
 */
require('dotenv').config();
const { pool } = require('../src/config/database');

async function checkSchema() {
    try {
        // Ver columnas de la tabla messages
        const { rows: columns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'messages'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Messages Table Schema:');
        console.log('========================');
        columns.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });
        console.log('========================\n');

        // Contar registros
        const { rows: count } = await pool.query('SELECT COUNT(*) FROM messages');
        console.log(`Total messages in DB: ${count[0].count}\n`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        // IDs to delete:
        // 9: alejandro
        // 8: Alejandro
        // 6: alejo
        // 5: Alejo
        // 3: gerardo
        // 4: ejemplo
        // 2: Daniela (keeping id 10: daniela luna)
        // 1: admin
        const idsToDelete = [1, 2, 3, 4, 5, 6, 8, 9];

        console.log(`🔄 Updating messages to remove references to agents: ${idsToDelete.join(', ')}`);
        await pool.query('UPDATE messages SET agent_id = NULL WHERE agent_id = ANY($1)', [idsToDelete]);

        console.log(`🗑️ Deleting agents from agents table...`);
        const { rowCount } = await pool.query('DELETE FROM agents WHERE id = ANY($1)', [idsToDelete]);

        console.log(`✅ Successfully deleted ${rowCount} agents.`);

        const { rows } = await pool.query('SELECT id, name, username FROM agents');
        console.log('Remaining agents:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('❌ Error during cleanup:', err);
    } finally {
        await pool.end();
    }
}

run();

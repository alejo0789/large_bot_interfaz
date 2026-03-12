const { Pool } = require('pg');
require('dotenv').config();

async function deleteTenants() {
    const pool = new Pool({
        connectionString: process.env.MASTER_DATABASE_URL
    });

    try {
        const slugs = ['alejo4', 'bogota', 'alejo41'];
        console.log('Deleting tenants with slugs:', slugs);
        
        const { rowCount } = await pool.query(
            'DELETE FROM tenants WHERE slug = ANY($1)',
            [slugs]
        );
        
        console.log(`Successfully deleted ${rowCount} tenants.`);
    } catch (err) {
        console.error('Error deleting tenants:', err.message);
    } finally {
        await pool.end();
    }
}

deleteTenants();

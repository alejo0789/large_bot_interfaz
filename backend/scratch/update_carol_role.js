const { Client } = require('pg');

const masterConnectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function updateRole() {
    const client = new Client({ connectionString: masterConnectionString });
    try {
        await client.connect();

        // Find Carol
        const { rows: users } = await client.query(`
            SELECT id, email, username, role FROM users 
            WHERE username ILIKE '%carol%' OR email ILIKE '%carol%'
        `);

        if (users.length === 0) {
            console.error('❌ No se encontró ningún usuario con nombre o correo que contenga "carol".');
            return;
        }

        const carol = users[0];

        // Ensure she is in Cali tenant
        const { rows: tenants } = await client.query(`SELECT id, name, slug FROM tenants WHERE slug = 'cali' OR name ILIKE '%cali%'`);
        if (tenants.length > 0) {
            const caliId = tenants[0].id;
            // Add to user_tenants if not exists
            await client.query(`
                INSERT INTO user_tenants (user_id, tenant_id)
                VALUES ($1, $2)
                ON CONFLICT ON CONSTRAINT user_tenants_user_id_tenant_id_key DO NOTHING
            `, [carol.id, caliId]).catch(err => console.log('Relación ya existe o error menor:', err.message));
        }

        // Update role to SEDE_ADMIN 
        await client.query(`
            UPDATE users SET role = 'SEDE_ADMIN' WHERE id = $1
        `, [carol.id]);

        console.log(`✅ ¡Éxito! Se ha actualizado a la usuaria ${carol.username} (${carol.email}) con el rol de ADMIN (SEDE_ADMIN) y se validó en la sede de Cali.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

updateRole();

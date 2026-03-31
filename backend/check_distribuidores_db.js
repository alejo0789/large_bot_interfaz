const { Pool } = require('pg');

const tenantDbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';
const masterDbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function check() {
    // 1. Check tenant config in master DB
    const masterPool = new Pool({ connectionString: masterDbUrl, ssl: { rejectUnauthorized: false } });
    try {
        const res = await masterPool.query("SELECT id, name, slug, db_url, evolution_instance FROM tenants WHERE slug = 'distribuidoresventas2'");
        console.log('--- Tenant config en Master DB ---');
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch(e) {
        console.error('❌ Error master DB:', e.message);
    } finally {
        await masterPool.end();
    }

    // 2. Check tenant DB directly
    const tenantPool = new Pool({ connectionString: tenantDbUrl, ssl: { rejectUnauthorized: false } });
    try {
        await tenantPool.query('SELECT 1');
        console.log('\n✅ Conexión a distribuidor_ventas_db OK');

        const convRes = await tenantPool.query('SELECT COUNT(*) FROM conversations');
        console.log(`📊 Conversations en DB: ${convRes.rows[0].count}`);

        const msgRes = await tenantPool.query('SELECT COUNT(*) FROM messages');
        console.log(`📊 Messages en DB: ${msgRes.rows[0].count}`);

        const recentConv = await tenantPool.query(
            'SELECT phone, contact_name, last_message_timestamp FROM conversations ORDER BY last_message_timestamp DESC NULLS LAST LIMIT 5'
        );
        console.log('\n--- Últimas 5 conversaciones en DB ---');
        recentConv.rows.forEach(r => {
            console.log(`  - ${r.phone} (${r.contact_name}): ${r.last_message_timestamp}`);
        });

        const recentMsg = await tenantPool.query(
            'SELECT conversation_phone, text_content, timestamp FROM messages ORDER BY timestamp DESC LIMIT 5'
        );
        console.log('\n--- Últimos 5 mensajes en DB ---');
        recentMsg.rows.forEach(r => {
            console.log(`  - [${r.conversation_phone}] ${r.text_content?.substring(0, 50)} @ ${r.timestamp}`);
        });

    } catch(e) {
        console.error('❌ Error tenant DB:', e.message);
    } finally {
        await tenantPool.end();
    }
}

check();

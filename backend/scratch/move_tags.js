const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function moveTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // 1. Get exact tag names (using case-insensitive search to be safe)
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name ILIKE '%nuevo mayo%' OR name ILIKE 'REMARKETING 01%'
        `);
        
        const sourceTag = tags.find(t => t.name.toLowerCase().includes('nuevo mayo'));
        const targetTag = tags.find(t => t.name.toUpperCase() === 'REMARKETING 01');

        if (!sourceTag) {
            console.error('❌ No se encontró ninguna etiqueta llamada "nuevo mayo". (Etiquetas encontradas:)', tags);
            return;
        }
        if (!targetTag) {
            console.error('❌ No se encontró la etiqueta "REMARKETING 01"');
            return;
        }

        console.log(`✅ Preparando para mover contactos de: "${sourceTag.name}" (ID: ${sourceTag.id}) Hacia -> "${targetTag.name}" (ID: ${targetTag.id})`);

        // 2. Insert into target tag ignoring duplicates (ON CONFLICT DO NOTHING)
        const insertRes = await client.query(`
            INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_by)
            SELECT conversation_phone, $2, assigned_by
            FROM conversation_tags
            WHERE tag_id = $1
            ON CONFLICT (conversation_phone, tag_id) DO NOTHING
        `, [sourceTag.id, targetTag.id]);

        console.log(`✅ Se asignó la etiqueta "REMARKETING 01" a ${insertRes.rowCount} contactos que no la tenían.`);

        // 3. Remove source tag from conversations
        const deleteRes = await client.query(`
            DELETE FROM conversation_tags 
            WHERE tag_id = $1
        `, [sourceTag.id]);

        console.log(`🗑️ Se desmarcaron ${deleteRes.rowCount} contactos de la etiqueta "NUEVO MAYO".`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

moveTags();

const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function moveTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // 1. Get exact tag names
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name ILIKE '%contactar de nuevo%' 
               OR name ILIKE 'REMARKETING 05%'
        `);
        
        const sourceTags = tags.filter(t => t.name.toLowerCase().includes('contactar de nuevo'));
        const targetTag = tags.find(t => t.name.toUpperCase() === 'REMARKETING 05');

        if (sourceTags.length === 0) {
            console.error('❌ No se encontró la etiqueta "contactar de nuevo". Etiquetas devueltas:', tags);
            return;
        }
        if (!targetTag) {
            console.error('❌ No se encontró la etiqueta "REMARKETING 05". Etiquetas devueltas:', tags);
            return;
        }

        const sourceIds = sourceTags.map(t => t.id);
        const sourceNames = sourceTags.map(t => `"${t.name}" (ID: ${t.id})`).join(' y ');

        console.log(`✅ Preparando para mover contactos de: ${sourceNames} Hacia -> "${targetTag.name}" (ID: ${targetTag.id})`);

        // 2. Insert into target tag ignoring duplicates (ON CONFLICT DO NOTHING)
        const insertRes = await client.query(`
            INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_by)
            SELECT DISTINCT conversation_phone, $2::integer, assigned_by
            FROM conversation_tags
            WHERE tag_id = ANY($1::int[])
            ON CONFLICT (conversation_phone, tag_id) DO NOTHING
        `, [sourceIds, targetTag.id]);

        console.log(`✅ Se asignó la etiqueta "REMARKETING 05" a ${insertRes.rowCount} contactos que no la tenían.`);

        // 3. Remove source tags from conversations
        const deleteRes = await client.query(`
            DELETE FROM conversation_tags 
            WHERE tag_id = ANY($1::int[])
        `, [sourceIds]);

        console.log(`🗑️ Se desmarcaron ${deleteRes.rowCount} contactos de las antiguas etiquetas (${sourceTags.map(t => t.name).join(', ')}).`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

moveTags();

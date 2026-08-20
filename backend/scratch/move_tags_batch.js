const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function moveTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // Define exact suffixes to match
        const sourceSuffixes = ['08','8','09','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26'];
        
        // 1. Get exact tag names
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name ILIKE 'REMARKETING %'
        `);
        
        const sourceTags = tags.filter(t => {
            const name = t.name.toLowerCase();
            return sourceSuffixes.some(s => name.endsWith(` ${s}`) || name === `remarketing ${s}`);
        });
        
        const targetTag = tags.find(t => t.name.toUpperCase() === 'REMARKETING 04');

        if (sourceTags.length === 0) {
            console.error('❌ No se encontraron las etiquetas de origen.');
            return;
        }
        if (!targetTag) {
            console.error('❌ No se encontró la etiqueta "REMARKETING 04".');
            return;
        }

        const sourceIds = sourceTags.map(t => t.id);
        const sourceNames = sourceTags.map(t => t.name).join(', ');

        console.log(`✅ Preparando para mover contactos de: [${sourceNames}]`);
        console.log(`➡️ Hacia -> "${targetTag.name}" (ID: ${targetTag.id})`);

        // 2. Insert into target tag ignoring duplicates (ON CONFLICT DO NOTHING)
        const insertRes = await client.query(`
            INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_by)
            SELECT DISTINCT conversation_phone, $2::integer, assigned_by
            FROM conversation_tags
            WHERE tag_id = ANY($1::int[])
            ON CONFLICT (conversation_phone, tag_id) DO NOTHING
        `, [sourceIds, targetTag.id]);

        console.log(`✅ Se asignó la etiqueta "REMARKETING 04" a ${insertRes.rowCount} contactos que no la tenían.`);

        // 3. Remove source tags from conversations
        const deleteRes = await client.query(`
            DELETE FROM conversation_tags 
            WHERE tag_id = ANY($1::int[])
        `, [sourceIds]);

        console.log(`🗑️ Se desmarcaron ${deleteRes.rowCount} contactos de las ${sourceTags.length} antiguas etiquetas.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

moveTags();

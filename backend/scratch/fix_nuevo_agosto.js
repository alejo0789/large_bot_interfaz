const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function moveTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // 1. Get exact tag names
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name ILIKE 'nuevo agosto%'
        `);
        
        console.log('Etiquetas encontradas:', tags);

        if (tags.length === 0) {
            console.error('❌ No se encontró ninguna etiqueta "nuevo agosto".');
            return;
        }

        // We want to keep the one that is exactly 'NUEVO AGOSTO', 
        // or just rename the existing one to 'NUEVO AGOSTO' if there's only one.
        if (tags.length === 1) {
            const t = tags[0];
            if (t.name === 'NUEVO AGOSTO') {
                console.log('✅ Ya existe una única etiqueta llamada "NUEVO AGOSTO"');
            } else {
                console.log(`Renombrando "${t.name}" a "NUEVO AGOSTO"...`);
                await client.query('UPDATE tags SET name = $1 WHERE id = $2', ['NUEVO AGOSTO', t.id]);
                console.log('✅ Etiqueta renombrada exitosamente.');
            }
            return;
        }

        // If there are multiple, keep the exact 'NUEVO AGOSTO' or the first one if exact doesn't exist
        let targetTag = tags.find(t => t.name === 'NUEVO AGOSTO');
        if (!targetTag) {
            targetTag = tags[0];
            console.log(`Renombrando "${targetTag.name}" a "NUEVO AGOSTO" para que sea la principal...`);
            await client.query('UPDATE tags SET name = $1 WHERE id = $2', ['NUEVO AGOSTO', targetTag.id]);
            targetTag.name = 'NUEVO AGOSTO';
        }

        const sourceTags = tags.filter(t => t.id !== targetTag.id);
        const sourceIds = sourceTags.map(t => t.id);

        if (sourceIds.length > 0) {
            console.log(`✅ Moviendo contactos de ${sourceTags.map(t => `"${t.name}"`).join(', ')} hacia "NUEVO AGOSTO" (ID: ${targetTag.id})`);

            const insertRes = await client.query(`
                INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_by)
                SELECT DISTINCT conversation_phone, $2::integer, assigned_by
                FROM conversation_tags
                WHERE tag_id = ANY($1::int[])
                ON CONFLICT (conversation_phone, tag_id) DO NOTHING
            `, [sourceIds, targetTag.id]);

            console.log(`✅ Se pasaron ${insertRes.rowCount} contactos a "NUEVO AGOSTO".`);

            const deleteRes = await client.query(`
                DELETE FROM conversation_tags WHERE tag_id = ANY($1::int[])
            `, [sourceIds]);

            console.log(`🗑️ Se limpiaron ${deleteRes.rowCount} contactos de las etiquetas duplicadas.`);

            const deleteTagsRes = await client.query(`
                DELETE FROM tags WHERE id = ANY($1::int[])
            `, [sourceIds]);

            console.log(`🗑️ Se eliminaron ${deleteTagsRes.rowCount} etiquetas duplicadas.`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

moveTags();

const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function deleteTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // Retrieve the tags by wildcard just in case there are typos
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name ILIKE '%botox%'
        `);

        if (tags.length === 0) {
            console.log('✅ No se encontró ninguna etiqueta con "botox" en su nombre.');
            return;
        }

        const tagIds = tags.map(t => t.id);
        const tagNames = tags.map(t => `"${t.name}" (ID: ${t.id})`).join(', ');

        console.log(`🗑️ Se encontraron ${tags.length} etiquetas para eliminar: ${tagNames}`);

        // Remove from conversation_tags
        const deleteRelations = await client.query(`
            DELETE FROM conversation_tags WHERE tag_id = ANY($1::int[])
        `, [tagIds]);
        console.log(`✅ Se desvincularon ${deleteRelations.rowCount} contactos que aún tenían estas etiquetas.`);

        // Delete from tags table
        const deleteTagsRes = await client.query(`
            DELETE FROM tags WHERE id = ANY($1::int[])
        `, [tagIds]);
        console.log(`✅ Se eliminaron permanentemente ${deleteTagsRes.rowCount} etiquetas de la base de datos.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

deleteTags();

const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function deleteTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // Generate suffixes 08 to 45
        const sourceSuffixes = [];
        for (let i = 8; i <= 45; i++) {
            sourceSuffixes.push(i.toString().padStart(2, '0'));
            sourceSuffixes.push(i.toString());
        }
        
        // 1. Get exact tag names
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name ILIKE 'REMARKETING %'
        `);
        
        const tagsToDelete = tags.filter(t => {
            const name = t.name.toLowerCase();
            return sourceSuffixes.some(s => name.endsWith(` ${s}`) || name === `remarketing ${s}`);
        });

        if (tagsToDelete.length === 0) {
            console.error('❌ No se encontraron las etiquetas a eliminar.');
            return;
        }

        const tagIds = tagsToDelete.map(t => t.id);
        const tagNames = tagsToDelete.map(t => t.name).join(', ');

        console.log(`✅ Preparando para ELIMINAR por completo las siguientes etiquetas: \n[${tagNames}]`);

        // First delete any relations from conversation_tags
        const deleteRels = await client.query(`
            DELETE FROM conversation_tags 
            WHERE tag_id = ANY($1::int[])
        `, [tagIds]);

        console.log(`🗑️ Se desmarcaron ${deleteRels.rowCount} contactos residuales que las tuvieran.`);

        // Then delete the tags themselves
        const deleteTagsRes = await client.query(`
            DELETE FROM tags 
            WHERE id = ANY($1::int[])
        `, [tagIds]);

        console.log(`🧨 ¡BOMBA! Se eliminaron permanentemente ${deleteTagsRes.rowCount} etiquetas de la plataforma.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

deleteTags();

const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function fixDuplicatedPhonesInTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        const { rows: tags } = await client.query(`
            SELECT id, name FROM tags 
            WHERE name IN ('REMARKETING 01', 'REMARKETING 02')
        `);
        
        const tag01 = tags.find(t => t.name === 'REMARKETING 01');
        const tag02 = tags.find(t => t.name === 'REMARKETING 02');

        if (!tag01 || !tag02) {
            console.error('❌ No se encontraron ambas etiquetas en la DB.');
            return;
        }

        console.log(`✅ IDs -> REMARKETING 01: ${tag01.id} | REMARKETING 02: ${tag02.id}`);

        // Buscar números que tienen ambas etiquetas
        const { rows: phonesWithBoth } = await client.query(`
            SELECT conversation_phone 
            FROM conversation_tags 
            WHERE tag_id IN ($1, $2)
            GROUP BY conversation_phone
            HAVING COUNT(DISTINCT tag_id) = 2
        `, [tag01.id, tag02.id]);

        console.log(`🔍 Se encontraron ${phonesWithBoth.length} números que tienen AMBAS etiquetas.`);

        if (phonesWithBoth.length > 0) {
            const phones = phonesWithBoth.map(p => p.conversation_phone);
            
            // Eliminar la etiqueta REMARKETING 01 (tag01.id) de esos números
            const res = await client.query(`
                DELETE FROM conversation_tags 
                WHERE tag_id = $1 AND conversation_phone = ANY($2::varchar[])
            `, [tag01.id, phones]);
            
            console.log(`🗑️ Se quitó la etiqueta "REMARKETING 01" de ${res.rowCount} conversaciones duplicadas.`);
        } else {
            console.log('✅ No hay números duplicados entre ambas etiquetas.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

fixDuplicatedPhonesInTags();

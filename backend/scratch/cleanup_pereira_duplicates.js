const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/pereira_db?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando limpieza de duplicados y LIDs...');

        // 1. Eliminar LIDs y Grupos (IDs muy largos o con formatos no telefónicos)
        // Definimos un "teléfono válido" como uno que tenga entre 8 y 13 dígitos (con o sin +)
        const deleteRes = await client.query(`
            DELETE FROM conversations 
            WHERE 
                (LENGTH(REPLACE(phone, '+', '')) > 13) -- LIDs o IDs de grupos largos
                OR (phone LIKE '%@g.us%')              -- Grupos explícitos
                OR (phone LIKE '%@s.whatsapp.net%')   -- JIDs completos (deberían ser solo el número)
        `);
        console.log(`✅ Eliminadas ${deleteRes.rowCount} conversaciones de tipo LID/Grupo.`);

        // 2. Normalizar y fusionar duplicados (ej: 573... vs +573...)
        const { rows: allConvs } = await client.query('SELECT phone, contact_name FROM conversations');
        
        const phoneGroups = {};
        allConvs.forEach(c => {
            const normalized = '+' + c.phone.replace(/\D/g, ''); // Normalizar a +dígitos
            if (!phoneGroups[normalized]) phoneGroups[normalized] = [];
            phoneGroups[normalized].push(c.phone);
        });

        for (const [normalized, originalPhones] of Object.entries(phoneGroups)) {
            // Si el teléfono actual no tiene el formato normalizado, lo corregiremos
            // Si hay varios que normalizan a lo mismo, los fusionaremos
            
            let mainPhone = originalPhones.find(p => p === normalized);
            
            if (originalPhones.length > 1 || !mainPhone) {
                console.log(`Processing group for ${normalized}: ${originalPhones.join(', ')}`);
                
                // Si no hay ninguno con el formato perfecto (+dígitos), elegimos el mejor
                if (!mainPhone) {
                    const { rows: details } = await client.query(
                        'SELECT phone, contact_name FROM conversations WHERE phone = ANY($1)',
                        [originalPhones]
                    );
                    
                    details.sort((a, b) => {
                        const aHasName = a.contact_name && a.contact_name !== a.phone;
                        const bHasName = b.contact_name && b.contact_name !== b.phone;
                        if (aHasName && !bHasName) return -1;
                        if (!aHasName && bHasName) return 1;
                        return 0;
                    });
                    mainPhone = details[0].phone;
                }

                // Si el mainPhone no es el normalized, primero lo renombramos (si es posible)
                // O mejor, creamos el normalized si no existe y movemos todo allí
                if (mainPhone !== normalized) {
                     // Check if normalized already exists (shouldn't be in this group if it did)
                     await client.query(`
                        INSERT INTO conversations (phone, contact_name, status, ai_enabled, created_at, updated_at)
                        SELECT $1, contact_name, status, ai_enabled, created_at, updated_at
                        FROM conversations WHERE phone = $2
                        ON CONFLICT (phone) DO NOTHING
                     `, [normalized, mainPhone]);
                     
                     const oldMain = mainPhone;
                     mainPhone = normalized;
                     if (!originalPhones.includes(normalized)) originalPhones.push(normalized);
                }

                const duplicates = originalPhones.filter(p => p !== mainPhone);

                for (const dupe of duplicates) {
                    // Mover mensajes
                    await client.query(
                        'UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2',
                        [mainPhone, dupe]
                    );
                    // Mover tags
                    const { rows: tags } = await client.query('SELECT tag_id FROM conversation_tags WHERE conversation_phone = $1', [dupe]);
                    for (const t of tags) {
                        await client.query(
                            'INSERT INTO conversation_tags (conversation_phone, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [mainPhone, t.tag_id]
                        );
                    }
                    await client.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [dupe]);

                    // Borrar duplicado
                    await client.query('DELETE FROM conversations WHERE phone = $1', [dupe]);
                    console.log(`  - Merged ${dupe} into ${mainPhone}`);
                }
            }
        }

        console.log('✨ Limpieza completada.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup();

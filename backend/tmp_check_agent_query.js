const { Client } = require('pg');

async function main() {
    const tenantUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require&channel_binding=require';
    const client = new Client({ connectionString: tenantUrl });
    
    try {
        await client.connect();
        
        const agentQuery = `
            WITH message_stats AS (
                -- Agrupamos por agent_id si existe, si no por el nombre o sender
                SELECT 
                    COALESCE(agent_id, agent_name, sender) as activity_id,
                    MAX(COALESCE(agent_name, sender)) as name_display,
                    COUNT(*) as msg_count 
                FROM messages 
                WHERE sender IN ('agent', 'me', 'bot', 'ai', 'system') 
                AND timestamp >= CURRENT_DATE
                GROUP BY COALESCE(agent_id, agent_name, sender)
            ),
            agenda_stats AS (
                SELECT ct.assigned_by as agent_id, COUNT(*) as agenda_count
                FROM conversation_tags ct
                JOIN tags t ON ct.tag_id = t.id
                WHERE t.name ILIKE 'Agendar'
                AND ct.assigned_at >= CURRENT_DATE
                GROUP BY ct.assigned_by
            ),
            combined AS (
                -- Primero: Agentes registrados en la tabla agents
                SELECT 
                    a.id as id,
                    a.name as agent_name,
                    COALESCE(ms.msg_count, 0) as message_count,
                    COALESCE(ags.agenda_count, 0) as agenda_count,
                    true as is_human
                FROM agents a
                LEFT JOIN message_stats ms ON a.id = ms.activity_id
                LEFT JOIN agenda_stats ags ON a.id = ags.agent_id
                WHERE a.is_active = true
                
                UNION ALL
                
                -- Segundo: Mensajes de bot/sistema/otros que no están en la tabla agents
                SELECT 
                    ms.activity_id as id,
                    CASE 
                        WHEN ms.activity_id IN ('bot', 'ai') THEN 'IA / Bot'
                        WHEN ms.activity_id = 'system' THEN 'Sistema'
                        ELSE ms.name_display
                    END as agent_name,
                    ms.msg_count as message_count,
                    COALESCE(ags.agenda_count, 0) as agenda_count,
                    false as is_human
                FROM message_stats ms
                LEFT JOIN agenda_stats ags ON ms.activity_id = ags.agent_id
                WHERE NOT EXISTS (SELECT 1 FROM agents WHERE id::text = ms.activity_id OR name = ms.activity_id)
            )
            SELECT 
                agent_name,
                message_count,
                agenda_count
            FROM combined
            WHERE message_count > 0 OR agenda_count > 0
            ORDER BY is_human DESC, message_count DESC
        `;

        const res = await client.query(agentQuery);
        console.log("agentQuery success:", res.rows);

    } catch (e) {
        console.error("Error in agentQuery:", e);
    } finally {
        await client.end();
    }
}

main();

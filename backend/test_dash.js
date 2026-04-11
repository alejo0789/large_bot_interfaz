const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const params = [];
  const dateFilterMsg = "timestamp >= '2000-01-01'";

  try {
     const receivedQuery = `
         SELECT COUNT(*) as count 
         FROM messages 
         WHERE sender NOT IN ('agent', 'me', 'system') 
         AND ${dateFilterMsg}
     `;
     console.log('Received:', (await pool.query(receivedQuery, params)).rows);

     const aiQuery = `
         SELECT COUNT(*) as count 
         FROM messages 
         WHERE sender IN ('bot', 'ai') 
         AND ${dateFilterMsg}
     `;
     console.log('AI:', (await pool.query(aiQuery, params)).rows);

     const unreadQuery = `
         SELECT COUNT(*) as count 
         FROM conversations 
         WHERE unread_count > 0 
         AND status = 'active'
     `;
     console.log('Unreads:', (await pool.query(unreadQuery, params)).rows);
     
     const dateFilterAgendas = dateFilterMsg.replace(/timestamp/g, 'assigned_at');
     const agentQuery = `
            WITH message_stats AS (
                SELECT 
                    COALESCE(agent_id, agent_name, sender) as activity_id,
                    MAX(COALESCE(agent_name, sender)) as name_display,
                    COUNT(*) as msg_count 
                FROM messages 
                WHERE sender IN ('agent', 'me', 'bot', 'ai', 'system') 
                AND ${dateFilterMsg}
                GROUP BY COALESCE(agent_id, agent_name, sender)
            ),
            agenda_stats AS (
                SELECT ct.assigned_by as agent_id, COUNT(*) as agenda_count
                FROM conversation_tags ct
                JOIN tags t ON ct.tag_id = t.id
                WHERE t.name ILIKE 'Agendar'
                AND ct.${dateFilterAgendas}
                GROUP BY ct.assigned_by
            ),
            combined AS (
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
            SELECT * FROM combined;
     `;
     console.log('Agents:', (await pool.query(agentQuery, params)).rows);
     
  } catch (e) {
      console.log('Error:', e.message);
  }
  pool.end();
}
check();

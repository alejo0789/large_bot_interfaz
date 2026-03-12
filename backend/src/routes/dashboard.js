const express = require('express');
const router = express.Router();
const { pool } = require('../config/database'); // Assuming database config is here

// --- DASHBOARD API ENDPOINTS ---

router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Configurar filtro de fecha
        let dateFilterMsg = "timestamp >= CURRENT_DATE";
        const params = [];

        if (startDate && endDate) {
            dateFilterMsg = "timestamp::date >= $1 AND timestamp::date <= $2";
            params.push(startDate, endDate);
        } else if (startDate) {
            dateFilterMsg = "timestamp::date = $1";
            params.push(startDate);
        }

        console.log(`📊 Fetching dashboard stats with filter: ${dateFilterMsg}, params: ${params}`);

        // 1. Mensajes Recibidos (Clientes)
        const receivedQuery = `
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE sender NOT IN ('agent', 'me', 'system') 
            AND ${dateFilterMsg}
        `;

        // 2. Mensajes Respondidos (Agentes Humanos)
        const sentQuery = `
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE sender IN ('agent', 'me') 
            AND ${dateFilterMsg}
        `;

        // 2b. Mensajes Respondidos (IA)
        const aiQuery = `
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE sender IN ('bot', 'ai') 
            AND ${dateFilterMsg}
        `;

        // 3. Conversaciones sin responder (Filtrado por fecha)
        let dateFilterUnread = "last_message_timestamp >= CURRENT_DATE";
        if (startDate && endDate) {
            dateFilterUnread = "last_message_timestamp::date >= $1 AND last_message_timestamp::date <= $2";
        } else if (startDate) {
            dateFilterUnread = "last_message_timestamp::date = $1";
        }

        const unreadQuery = `
            SELECT COUNT(*) as count 
            FROM conversations 
            WHERE unread_count > 0 
            AND status = 'active'
            AND ${dateFilterUnread}
        `;

        // 4. Rendimiento por Agente (Asegurando que humanos e IA se cuenten por separado)
        const dateFilterAgendas = dateFilterMsg.replace(/timestamp/g, 'assigned_at');
        const agentQuery = `
            WITH active_agents AS (
                SELECT id, name FROM agents WHERE is_active = true
            ),
            message_stats AS (
                -- Primero agrupamos mensajes por quien los enviÃ³
                -- Para humanos usamos agent_id, para sistemas usamos sender
                SELECT 
                    COALESCE(agent_id, sender) as activity_id,
                    COUNT(*) as msg_count 
                FROM messages 
                WHERE sender IN ('agent', 'me', 'bot', 'ai', 'system') 
                AND ${dateFilterMsg}
                GROUP BY COALESCE(agent_id, sender)
            ),
            agenda_stats AS (
                -- Contamos agendas asociadas al agente
                SELECT ct.assigned_by as agent_id, COUNT(*) as agenda_count
                FROM conversation_tags ct
                JOIN tags t ON ct.tag_id = t.id
                WHERE t.name ILIKE 'Agendar'
                AND ct.${dateFilterAgendas}
                GROUP BY ct.assigned_by
            ),
            combined AS (
                -- Unimos agentes registrados con sus estadÃ­sticas
                SELECT 
                    a.id as agent_id,
                    a.name as agent_name,
                    COALESCE(ms.msg_count, 0) as message_count,
                    COALESCE(ags.agenda_count, 0) as agenda_count,
                    true as is_human
                FROM active_agents a
                LEFT JOIN message_stats ms ON a.id = ms.activity_id
                LEFT JOIN agenda_stats ags ON a.id = ags.agent_id
                
                UNION ALL
                
                -- Agregamos actividad de IA y Sistema que no estÃ© asociada a un agente UUID
                SELECT 
                    ms.activity_id as agent_id,
                    CASE 
                        WHEN ms.activity_id IN ('bot', 'ai') THEN 'IA / Bot'
                        WHEN ms.activity_id = 'system' THEN 'Sistema'
                        ELSE 'Sede/Otros'
                    END as agent_name,
                    ms.msg_count as message_count,
                    COALESCE(ags.agenda_count, 0) as agenda_count,
                    false as is_human
                FROM message_stats ms
                LEFT JOIN agenda_stats ags ON ms.activity_id = ags.agent_id
                WHERE ms.activity_id IN ('bot', 'ai', 'system')
            )
            SELECT 
                agent_name,
                message_count,
                agenda_count
            FROM combined
            WHERE is_human = true OR message_count > 0 OR agenda_count > 0
            ORDER BY is_human DESC, message_count DESC
        `;

        // 5. Nuevas Conversaciones (Filtrado por fecha de creación)
        let dateFilterCreated = "created_at >= CURRENT_DATE";
        if (startDate && endDate) {
            dateFilterCreated = "created_at::date >= $1 AND created_at::date <= $2";
        } else if (startDate) {
            dateFilterCreated = "created_at::date = $1";
        }

        const newConversationsQuery = `
            SELECT COUNT(*) as count 
            FROM conversations 
            WHERE ${dateFilterCreated}
        `;

        const [received, sent, ai, unreads, agents, newConversations] = await Promise.all([
            pool.query(receivedQuery, params),
            pool.query(sentQuery, params),
            pool.query(aiQuery, params),
            pool.query(unreadQuery, params),
            pool.query(agentQuery, params),
            pool.query(newConversationsQuery, params)
        ]);

        const stats = {
            received: parseInt(received.rows[0]?.count || 0),
            sent: parseInt(sent.rows[0]?.count || 0),
            aiSent: parseInt(ai.rows[0]?.count || 0),
            unanswered: parseInt(unreads.rows[0]?.count || 0),
            newConversations: parseInt(newConversations.rows[0]?.count || 0),
            agents: agents.rows.map(row => ({
                name: row.agent_name || 'Agente',
                count: parseInt(row.message_count),
                agendas: parseInt(row.agenda_count)
            }))
        };

        console.log('✅ Dashboard stats loaded:', stats);
        res.json(stats);

    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        console.error(error.stack);
        res.status(500).json({ error: 'Error cargando estadísticas' });
    }
});

router.get('/charts', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let period = 'hour'; // default for single day
        let dateFilter = "timestamp >= CURRENT_DATE";
        const params = [];

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = (end - start) / (1000 * 60 * 60 * 24);

            if (daysDiff > 2) period = 'day';

            dateFilter = "timestamp::date >= $1 AND timestamp::date <= $2";
            params.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = "timestamp::date = $1";
            params.push(startDate);
        }

        console.log(`📈 Fetching dashboard charts with period: ${period}`);

        // Gráfica de mensajes recibidos vs enviados (Agente e IA)
        const chartQuery = `
            SELECT 
                date_trunc($${params.length + 1}, timestamp) as time_slot,
                SUM(CASE WHEN sender NOT IN ('agent', 'me', 'system', 'bot', 'ai') THEN 1 ELSE 0 END) as received,
                SUM(CASE WHEN sender IN ('agent', 'me') THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN sender IN ('bot', 'ai') THEN 1 ELSE 0 END) as ai
            FROM messages
            WHERE ${dateFilter}
            GROUP BY time_slot
            ORDER BY time_slot ASC
        `;

        // Gráfica de Nuevas Conversaciones
        const dateFilterConv = dateFilter.replace(/timestamp/g, 'created_at');
        const convQuery = `
            SELECT 
                date_trunc($${params.length + 1}, created_at) as time_slot,
                COUNT(*) as created
            FROM conversations
            WHERE ${dateFilterConv}
            GROUP BY time_slot
            ORDER BY time_slot ASC
        `;

        const chartParams = [...params, period];

        const [msgRes, convRes] = await Promise.all([
            pool.query(chartQuery, chartParams),
            pool.query(convQuery, chartParams)
        ]);

        // Merge Data
        const dataMap = new Map();

        // Process Messages
        msgRes.rows.forEach(row => {
            const timeKey = row.time_slot.toISOString();
            if (!dataMap.has(timeKey)) {
                dataMap.set(timeKey, { time_slot: row.time_slot, received: 0, sent: 0, ai: 0, created: 0 });
            }
            const data = dataMap.get(timeKey);
            data.received = parseInt(row.received);
            data.sent = parseInt(row.sent);
            data.ai = parseInt(row.ai);
        });

        // Process Conversations
        convRes.rows.forEach(row => {
            const timeKey = row.time_slot.toISOString();
            if (!dataMap.has(timeKey)) {
                dataMap.set(timeKey, { time_slot: row.time_slot, received: 0, sent: 0, ai: 0, created: 0 });
            }
            const data = dataMap.get(timeKey);
            data.created = parseInt(row.created);
        });

        // Convert Map to Array and Sort
        const chartData = Array.from(dataMap.values())
            .sort((a, b) => new Date(a.time_slot) - new Date(b.time_slot))
            .map(row => ({
                time: period === 'hour'
                    ? new Date(row.time_slot).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                    : new Date(row.time_slot).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
                received: row.received,
                sent: row.sent,
                ai: row.ai,
                created: row.created,
                rawTime: row.time_slot
            }));

        res.json(chartData);

    } catch (error) {
        console.error('❌ Error fetching chart data:', error);
        res.status(500).json({ error: 'Error cargando gráficas' });
    }
});

module.exports = router;

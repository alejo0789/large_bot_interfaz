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

        // 2. Mensajes Respondidos (Agentes)
        const sentQuery = `
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE sender IN ('agent', 'me') 
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

        // 4. Rendimiento por Agente (Incluyendo agentes con 0 mensajes)
        const agentQuery = `
            WITH active_agents AS (
                SELECT name FROM agents WHERE is_active = true
            ),
            message_stats AS (
                SELECT COALESCE(agent_name, 'Número Sede') as name, COUNT(*) as count 
                FROM messages 
                WHERE sender IN ('agent', 'me') 
                AND ${dateFilterMsg}
                GROUP BY agent_name
            )
            SELECT 
                COALESCE(s.name, a.name) as agent_name,
                COALESCE(s.count, 0) as count
            FROM active_agents a
            FULL OUTER JOIN message_stats s ON a.name = s.name
            ORDER BY count DESC
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

        const [received, sent, unreads, agents, newConversations] = await Promise.all([
            pool.query(receivedQuery, params),
            pool.query(sentQuery, params),
            pool.query(unreadQuery, params),
            pool.query(agentQuery, params),
            pool.query(newConversationsQuery, params)
        ]);

        const stats = {
            received: parseInt(received.rows[0]?.count || 0),
            sent: parseInt(sent.rows[0]?.count || 0),
            unanswered: parseInt(unreads.rows[0]?.count || 0),
            newConversations: parseInt(newConversations.rows[0]?.count || 0),
            agents: agents.rows.map(row => ({
                name: row.agent_name || 'Número Sede',
                count: parseInt(row.count)
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

        // Gráfica de mensajes recibidos vs enviados
        const chartQuery = `
            SELECT 
                date_trunc($${params.length + 1}, timestamp) as time_slot,
                SUM(CASE WHEN sender NOT IN ('agent', 'me', 'system') THEN 1 ELSE 0 END) as received,
                SUM(CASE WHEN sender IN ('agent', 'me') THEN 1 ELSE 0 END) as sent
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
                dataMap.set(timeKey, { time_slot: row.time_slot, received: 0, sent: 0, created: 0 });
            }
            const data = dataMap.get(timeKey);
            data.received = parseInt(row.received);
            data.sent = parseInt(row.sent);
        });

        // Process Conversations
        convRes.rows.forEach(row => {
            const timeKey = row.time_slot.toISOString();
            if (!dataMap.has(timeKey)) {
                dataMap.set(timeKey, { time_slot: row.time_slot, received: 0, sent: 0, created: 0 });
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

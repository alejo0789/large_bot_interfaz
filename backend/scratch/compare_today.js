const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function compare() {
    const today = new Date();
    today.setHours(0,0,0,0);

    console.log(`🔍 Buscando chats activos hoy en Evolution (Desde: ${today.toISOString()})...`);
    
    // 1. Fetch chats from Evolution
    const chatRes = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 500 })
    });
    
    const chats = await chatRes.json();
    
    // Filter by updatedAt (string ISO)
    const activeTodayEvo = chats.filter(c => c.updatedAt && new Date(c.updatedAt) >= today);

    console.log(`✅ ${activeTodayEvo.length} chats activos hoy en los primeros 500 de Evolution.`);

    // 2. Fetch chats with messages today from DB
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const { rows: dbMessages } = await pool.query(`
        SELECT DISTINCT conversation_phone 
        FROM messages 
        WHERE timestamp >= $1
    `, [today.toISOString()]);
    
    const phonesInDb = new Set(dbMessages.map(m => m.conversation_phone.replace(/\D/g, '')));
    
    console.log(`📊 Chats con registros hoy en nuestra DB: ${phonesInDb.size}`);

    // 3. Compare
    console.log('\n--- Análisis de Chats Faltantes ---');
    let missingCount = 0;
    for (const chat of activeTodayEvo) {
        const fullJid = chat.remoteJid || chat.id;
        const phone = fullJid.split('@')[0];
        
        if (!phonesInDb.has(phone)) {
            const lastMsg = chat.lastMessage?.message?.conversation || 
                            chat.lastMessage?.message?.extendedTextMessage?.text || 
                            'Media/Other';
            
            console.log(`❌ No llegó: ${phone} (${chat.pushName || 'S.N'}) - Último: "${lastMsg.substring(0, 30)}..." @ ${new Date(chat.updatedAt).toLocaleTimeString()}`);
            missingCount++;
        }
    }

    if (activeTodayEvo.length > 0 && missingCount === 0) {
        console.log('✅ Excelente: Todos los chats activos hoy en Evolution tienen sus mensajes en la DB.');
    } else {
        console.log(`\n⚠️ Total mensajes/chats que se perdieron hoy: ${missingCount}`);
    }

    await pool.end();
}

compare().catch(console.error);

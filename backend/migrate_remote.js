require('dotenv').config();
const { Pool } = require('pg');

async function migrateRemote() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔄 Conectando a la base de datos remota (Neon)...');
        await pool.query('SELECT 1');
        console.log('✅ Conexión establecida.');

        console.log('🔄 Creando tabla ai_knowledge...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_knowledge (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(20) NOT NULL,
                title VARCHAR(255),
                content TEXT,
                media_url TEXT,
                filename VARCHAR(255),
                keywords TEXT[],
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_ai_knowledge_type_remote ON ai_knowledge(type);
            CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active_remote ON ai_knowledge(active);
        `);
        console.log('✅ Tabla ai_knowledge creada exitosamente en el servidor remoto.');
    } catch (error) {
        console.error('❌ Error migrando servidor remoto:', error.message);
    } finally {
        await pool.end();
    }
}

migrateRemote();

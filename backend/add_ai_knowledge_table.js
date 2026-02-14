require('dotenv').config({ path: '../.env' }); // Intentar subir un nivel si está en backend/..
if (!process.env.DB_USER) {
    require('dotenv').config({ path: '../../.env' }); // Intentar subir dos niveles
}
if (!process.env.DB_USER) {
    console.warn('⚠️ No se pudo cargar .env, intentando variables de entorno del sistema o valores por defecto');
}

const { Pool } = require('pg');

// Lógica de conexión igual a server.js
const parseDbUrl = (url) => {
    if (!url) return null;
    const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);
    if (match) {
        return {
            user: match[1],
            password: match[2],
            host: match[3],
            port: parseInt(match[4]),
            database: match[5]
        };
    }
    return null;
};

const dbConfig = parseDbUrl(process.env.DATABASE_URL);

const pool = new Pool({
    user: dbConfig?.user || process.env.DB_USER || 'postgres',
    password: dbConfig?.password || process.env.DB_PASSWORD || 'root',
    host: dbConfig?.host || process.env.DB_HOST || 'localhost',
    port: dbConfig?.port || process.env.DB_PORT || 5432,
    database: dbConfig?.database || process.env.DB_NAME || 'chatbot_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    try {
        console.log('🔄 Iniciando migración de tabla AI Knowledge...');

        // Verificar conexión primero
        const client = await pool.connect();
        console.log('✅ Conexión a DB exitosa');
        client.release();

        await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS ai_knowledge (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          type VARCHAR(20) NOT NULL, -- 'image', 'video', 'audio', 'text'
          title VARCHAR(255), -- Para contexto de texto
          content TEXT, -- Contenido de texto o descripción de medios
          media_url TEXT, -- URL del archivo para medios
          filename VARCHAR(255), -- Nombre original del archivo
          keywords TEXT[], -- Array de palabras clave
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Índices para búsqueda rápida
      CREATE INDEX IF NOT EXISTS idx_ai_knowledge_type ON ai_knowledge(type);
      CREATE INDEX IF NOT EXISTS idx_ai_knowledge_active ON ai_knowledge(active);
    `);

        console.log('✅ Tabla ai_knowledge creada exitosamente');
    } catch (error) {
        console.error('❌ Error en migración:', error);
    } finally {
        await pool.end();
    }
}

migrate();

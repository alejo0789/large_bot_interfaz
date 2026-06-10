const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require",
});

async function runMigration() {
    try {
        console.log('🔄 Iniciando actualización de base de datos para pgvector...');

        // 1. Crear extensión vector
        console.log('📦 Creando extensión vector...');
        await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
        console.log('✅ Extensión vector creada.');

        // 2. Añadir columna embedding
        console.log('🧬 Añadiendo columna embedding a ai_knowledge...');
        // Verificamos si la columna ya existe primero
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='ai_knowledge' AND column_name='embedding';
        `);

        if (checkColumn.rows.length === 0) {
            await pool.query('ALTER TABLE ai_knowledge ADD COLUMN embedding vector(3072);');
            console.log('✅ Columna embedding añadida exitosamente.');
        } else {
            console.log('ℹ️ La columna embedding ya existía.');
        }

        console.log('🚀 Migración completada con éxito.');
    } catch (err) {
        console.error('❌ Error ejecutando la migración:', err);
    } finally {
        await pool.end();
    }
}

runMigration();

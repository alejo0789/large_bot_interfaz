
const { pool } = require('./src/config/database');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function initDb() {
    try {
        console.log('--- Inicializando base de datos ---');

        // 1. Crear tabla agents
        console.log('Creando tabla agents si no existe...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agents (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_login TIMESTAMP WITH TIME ZONE
            )
        `);

        // 2. Crear usuario admin
        const username = 'admin';
        const rawPassword = 'admin123';
        const name = 'Administrador';

        const existing = await pool.query('SELECT id FROM agents WHERE username = $1', [username]);

        const passwordHash = await bcrypt.hash(rawPassword, 10);

        if (existing.rows.length > 0) {
            console.log('Actualizando usuario admin existente...');
            await pool.query(
                'UPDATE agents SET password_hash = $1, name = $2 WHERE id = $3',
                [passwordHash, name, existing.rows[0].id]
            );
        } else {
            console.log('Creando nuevo usuario admin...');
            await pool.query(
                'INSERT INTO agents (username, password_hash, name, email) VALUES ($1, $2, $3, $4)',
                [username, passwordHash, name, 'admin@example.com']
            );
        }

        // 3. Verificar tablas existentes para reporte
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tablas actuales:', tables.rows.map(r => r.table_name).join(', '));

        console.log('✅ Operación completada con éxito.');
        console.log(`\nCredenciales:\nUsuario: ${username}\nClave: ${rawPassword}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    }
}

initDb();

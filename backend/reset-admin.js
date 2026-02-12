
const { pool } = require('./src/config/database');
const authService = require('./src/services/authService');
require('dotenv').config();

async function resetAdmin() {
    try {
        console.log('--- Reseteando/Creando usuario admin ---');

        // Verificamos si ya existe el usuario 'admin'
        const existing = await pool.query('SELECT id FROM agents WHERE username = $1', ['admin']);

        if (existing.rows.length > 0) {
            console.log('El usuario admin ya existe, actualizando contraseña a "admin123"...');
            await authService.updateAgent(existing.rows[0].id, { password: 'admin123' });
            console.log('✅ Contraseña actualizada correctamente.');
        } else {
            console.log('Creando nuevo usuario admin con contraseña "admin123"...');
            await authService.register('admin', 'admin123', 'Administrador', 'admin@example.com');
            console.log('✅ Usuario admin creado correctamente.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

resetAdmin();

/**
 * Settings Service
 * Manages global application settings
 */
const { Pool } = require('pg');
const { config } = require('../config/app');

// We use the same pool logic as other services, assuming direct pool usage or singleton
// For simplicity/consistency with this codebase, I'll instantiate a pool if not exported centrally,
// BUT looking at previous files, they seem to use a pool from config or creating new ones.
// Best practice: Use a shared db module. I will replicate the pattern seen in n8nService/evolutionService.
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require'
});

class SettingsService {

    /**
     * Get a setting by key
     * @param {string} key 
     * @param {any} defaultValue 
     */
    async get(key, defaultValue = null) {
        try {
            const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
            if (res.rows.length > 0) {
                return res.rows[0].value;
            }
            return defaultValue;
        } catch (error) {
            console.error(`Error getting setting ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Set a setting
     * @param {string} key 
     * @param {any} value 
     */
    async set(key, value) {
        try {
            // Value is stored as JSONB, so we can pass objects, booleans, etc.
            // But pg driver needs string or params. simpler to let pg handle json casting if defined as JSONB
            await pool.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = $2::jsonb',
                [key, JSON.stringify(value)]
            );
            return true;
        } catch (error) {
            console.error(`Error setting ${key}:`, error);
            return false;
        }
    }

    /**
     * Get all settings
     */
    async getAll() {
        try {
            const res = await pool.query('SELECT key, value FROM settings');
            const settings = {};
            res.rows.forEach(row => {
                settings[row.key] = row.value;
            });
            return settings;
        } catch (error) {
            console.error('Error getting all settings:', error);
            return {};
        }
    }
}

module.exports = new SettingsService();

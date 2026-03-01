/**
 * Settings Service
 * Manages global application settings
 */
const { pool } = require('../config/database');
const { config } = require('../config/app');

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

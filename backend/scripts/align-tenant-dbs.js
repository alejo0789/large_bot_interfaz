const { Pool } = require('pg');
require('dotenv').config();

const masterPool = process.env.MASTER_DATABASE_URL
    ? new Pool({ 
        connectionString: process.env.MASTER_DATABASE_URL, 
        ssl: process.env.MASTER_DATABASE_URL.includes('localhost') || process.env.MASTER_DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false } 
      })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'root',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'chatbot_master'
    });

async function alignDatabases() {
    try {
        console.log('🔍 Fetching tenants...');
        const tenantFilter = process.argv[2];
        let query = 'SELECT id, slug, db_url FROM tenants WHERE is_active = true';
        let params = [];

        if (tenantFilter) {
            query += ' AND slug = $1';
            params.push(tenantFilter);
        }

        const { rows: tenants } = await masterPool.query(query, params);
        console.log(`Found ${tenants.length} tenants to align.`);

        for (const tenant of tenants) {
            console.log(`\n🏗️ Aligning database for tenant: ${tenant.slug}`);
            const tenantPool = new Pool({
                connectionString: tenant.db_url,
                ssl: tenant.db_url.includes('localhost') || tenant.db_url.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
            });

            try {
                // Extension for vectors (if available) - Handled separately
                await tenantPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').catch(e => console.warn(`  ⚠️ uuid-ossp failed: ${e.message}`));
                await tenantPool.query('CREATE EXTENSION IF NOT EXISTS vector').catch(e => console.warn(`  ⚠️ vector extension not available on this server`));

                // 1. Core Tables
                await tenantPool.query(`
                    -- AGENTS (Updated to match Master DB UUIDs)
                    CREATE TABLE IF NOT EXISTS agents (
                        id VARCHAR(50) PRIMARY KEY,
                        username VARCHAR(100) UNIQUE NOT NULL,
                        password_hash VARCHAR(255),
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(100),
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        last_login TIMESTAMP WITH TIME ZONE
                    );

                    -- TAGS
                    CREATE TABLE IF NOT EXISTS tags (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) UNIQUE NOT NULL,
                        color VARCHAR(20) DEFAULT '#808080',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                    
                    -- CONVERSATIONS
                    CREATE TABLE IF NOT EXISTS conversations (
                        phone VARCHAR(50) PRIMARY KEY,
                        contact_name VARCHAR(255),
                        profile_pic_url TEXT,
                        status VARCHAR(20) DEFAULT 'active',
                        conversation_state VARCHAR(50) DEFAULT 'ai_active',
                        ai_enabled BOOLEAN DEFAULT TRUE,
                        agent_id VARCHAR(50),
                        taken_by_agent_at TIMESTAMP WITH TIME ZONE,
                        unread_count INTEGER DEFAULT 0,
                        last_message_text TEXT,
                        last_message_timestamp TIMESTAMP WITH TIME ZONE,
                        last_message_from_me BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        is_pinned BOOLEAN DEFAULT FALSE,
                        lead_intent VARCHAR(255),
                        lead_time VARCHAR(255),
                        metadata JSONB
                    );

                    -- CONVERSATION_TAGS
                    CREATE TABLE IF NOT EXISTS conversation_tags (
                        conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE CASCADE,
                        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        assigned_by VARCHAR(255),
                        PRIMARY KEY (conversation_phone, tag_id)
                    );

                    -- MESSAGES
                    CREATE TABLE IF NOT EXISTS messages (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        whatsapp_id VARCHAR(255) UNIQUE,
                        conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE CASCADE,
                        sender VARCHAR(20) NOT NULL,
                        sender_type VARCHAR(20) DEFAULT 'text',
                        text_content TEXT,
                        media_url TEXT,
                        media_type TEXT,
                        status VARCHAR(20) DEFAULT 'delivered',
                        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        is_internal_note BOOLEAN DEFAULT FALSE,
                        agent_id VARCHAR(50),
                        agent_name VARCHAR(100),
                        sender_name VARCHAR(255),
                        reactions JSONB DEFAULT '[]',
                        reply_to_id VARCHAR(255),
                        reply_to_text TEXT,
                        reply_to_sender VARCHAR(255)
                    );

                    -- QUICK REPLIES
                    CREATE TABLE IF NOT EXISTS quick_replies (
                        id SERIAL PRIMARY KEY,
                        shortcut VARCHAR(50) UNIQUE NOT NULL,
                        content TEXT NOT NULL,
                        media_url TEXT,
                        media_type VARCHAR(20),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );

                    -- SETTINGS
                    CREATE TABLE IF NOT EXISTS settings (
                        key VARCHAR(100) PRIMARY KEY,
                        value TEXT,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );

                    -- BULK TEMPLATES
                    CREATE TABLE IF NOT EXISTS bulk_templates (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        content TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                `);

                // AI KNOWLEDGE (May fail if vector is missing)
                try {
                    await tenantPool.query(`
                        CREATE TABLE IF NOT EXISTS ai_knowledge (
                            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            type VARCHAR(20) NOT NULL,
                            title VARCHAR(255),
                            content TEXT,
                            media_url TEXT,
                            filename VARCHAR(255),
                            keywords TEXT[],
                            active BOOLEAN DEFAULT TRUE,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                            embedding vector(3072)
                        );
                    `);
                } catch (e) {
                    console.warn('  ⚠️ AI Knowledge (with vector) could not be created, trying without embedding...');
                    await tenantPool.query(`
                        CREATE TABLE IF NOT EXISTS ai_knowledge (
                            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
                    `);
                }
                console.log('  ✅ Core tables verified/created');

                // 2. Fix legacy agents.id and its references if they were integers
                await tenantPool.query(`
                    DO $$ 
                    BEGIN 
                        -- Migrate agents.id
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='id' AND data_type='integer') THEN
                            ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_agent_id_fkey;
                            ALTER TABLE agents ALTER COLUMN id TYPE VARCHAR(50);
                        END IF;

                        -- Migrate conversations.agent_id
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='agent_id' AND data_type='integer') THEN
                            ALTER TABLE conversations ALTER COLUMN agent_id TYPE VARCHAR(50);
                        END IF;

                        -- Migrate messages.agent_id
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='agent_id' AND data_type='integer') THEN
                            ALTER TABLE messages ALTER COLUMN agent_id TYPE VARCHAR(50);
                        END IF;
                    END $$;
                `).catch(e => console.warn(`  ⚠️ Could not migrate legacy integer IDs: ${e.message}`));

                // 3. Sync Agents from Master DB
                try {
                    const agentsToSync = await masterPool.query(`
                        SELECT u.id::text, u.username, u.password_hash, u.full_name as name, u.email, u.is_active
                        FROM users u
                        LEFT JOIN user_tenants ut ON u.id = ut.user_id
                        WHERE ut.tenant_id = $1 OR u.role = 'SUPER_ADMIN'
                    `, [tenant.id]);

                    for (const agent of agentsToSync.rows) {
                        // We use a more robust upsert that handles both ID and username conflicts
                        // If username matches but ID is different, we update the ID to keep consistency with Master
                        await tenantPool.query(`
                            INSERT INTO agents (id, username, password_hash, name, email, is_active)
                            VALUES ($1, $2, $3, $4, $5, $6)
                            ON CONFLICT (username) DO UPDATE SET
                                id = EXCLUDED.id,
                                password_hash = EXCLUDED.password_hash,
                                name = EXCLUDED.name,
                                email = EXCLUDED.email,
                                is_active = EXCLUDED.is_active;
                        `, [agent.id, agent.username, agent.password_hash, agent.name, agent.email, agent.is_active]);
                    }
                    console.log(`  ✅ Synced ${agentsToSync.rows.length} agents from master`);
                } catch (syncErr) {
                    console.error(`  ❌ Agent sync failed for ${tenant.slug}:`, syncErr.message);
                }

                // 2. Ensure columns exist (for cases where table already existed but was missing columns)
                await tenantPool.query(`
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_state VARCHAR(50) DEFAULT 'ai_active';
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(255);
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_time VARCHAR(255);
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN DEFAULT FALSE;
                    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB;
                    
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id VARCHAR(50);
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]';
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR(255);
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT;
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_sender VARCHAR(255);
                    
                    ALTER TABLE conversation_tags ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                    ALTER TABLE conversation_tags ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(255);
                `);
                console.log('  ✅ Extra columns verified');

            } catch (err) {
                console.error(`  ❌ Error aligning ${tenant.slug}:`, err.message);
            } finally {
                await tenantPool.end();
            }
        }
    } catch (error) {
        console.error('❌ Master Error:', error.message);
    } finally {
        await masterPool.end();
    }
}

alignDatabases();

-- EXTENSIONS --
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
    phone VARCHAR(50) PRIMARY KEY,
    contact_name VARCHAR(255),
    profile_pic_url TEXT,
    
    -- Status & State
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'blocked'
    conversation_state VARCHAR(50) DEFAULT 'ai_active', -- 'ai_active', 'agent_active'
    
    -- AI & Agent
    ai_enabled BOOLEAN DEFAULT TRUE,
    agent_id VARCHAR(50), -- ID del agente asignado
    taken_by_agent_at TIMESTAMP WITH TIME ZONE,
    
    -- Stats
    unread_count INTEGER DEFAULT 0,
    last_message_text TEXT,
    last_message_timestamp TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_id VARCHAR(255) UNIQUE, -- ID que viene de Meta/WhatsApp
    conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE CASCADE,
    
    sender VARCHAR(20) NOT NULL, -- 'user', 'me', 'system', 'agent'
    sender_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'audio', 'document'
    
    text_content TEXT,
    media_url TEXT,
    media_type TEXT,
    
    status VARCHAR(20) DEFAULT 'delivered', -- 'sent', 'delivered', 'read', 'failed'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    is_internal_note BOOLEAN DEFAULT FALSE -- Para notas internas de agentes
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_phone);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_timestamp);


-- 3. TAGS SYSTEM (NEW)
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT '#808080', -- Hex code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (conversation_phone, tag_id)
);

-- Seed some default tags
INSERT INTO tags (name, color) VALUES 
('Importante', '#FF0000'), 
('Ventas', '#00FF00'), 
('Soporte', '#0000FF'), 
('Seguimiento', '#FFA500')
ON CONFLICT (name) DO NOTHING;

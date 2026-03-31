-- EXTENSIONS --
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AGENTS (Synced from Master DB users)
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

-- 2. TAGS
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT '#808080',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
    phone VARCHAR(50) PRIMARY KEY,
    contact_name VARCHAR(255),
    profile_pic_url TEXT,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'blocked'
    conversation_state VARCHAR(50) DEFAULT 'ai_active', -- 'ai_active', 'agent_active'
    ai_enabled BOOLEAN DEFAULT TRUE,
    agent_id VARCHAR(50),
    taken_by_agent_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER DEFAULT 0,
    last_message_text TEXT,
    last_message_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_pinned BOOLEAN DEFAULT FALSE
);

-- 4. CONVERSATION_TAGS
CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by VARCHAR(255),
    PRIMARY KEY (conversation_phone, tag_id)
);

-- 5. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_id VARCHAR(255) UNIQUE,
    conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL, -- 'user', 'me', 'system', 'agent'
    sender_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'audio', 'document'
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

-- 6. QUICK REPLIES
CREATE TABLE IF NOT EXISTS quick_replies (
    id SERIAL PRIMARY KEY,
    shortcut VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. BULK TEMPLATES
CREATE TABLE IF NOT EXISTS bulk_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. AI KNOWLEDGE
CREATE TABLE IF NOT EXISTS ai_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL, -- 'text', 'file', 'url'
    title VARCHAR(255),
    content TEXT,
    media_url TEXT,
    filename VARCHAR(255),
    keywords TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_phone);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_timestamp);

-- Seed some default tags
INSERT INTO tags (name, color) VALUES 
('Importante', '#FF0000'), 
('Ventas', '#00FF00'), 
('Soporte', '#0000FF'), 
('Seguimiento', '#FFA500'),
('LID_6H', '#E0E0E0'),
('LID_12H', '#BDBDBD'),
('LID_1D', '#9E9E9E'),
('LID_2D', '#757575'),
('LID_3D_PLUS', '#424242'),
('LID_INTERESADO', '#4CAF50'),
('LID_MEDIO', '#FF9800'),
('LID_NO_INTERESADO', '#F44336')
ON CONFLICT (name) DO NOTHING;

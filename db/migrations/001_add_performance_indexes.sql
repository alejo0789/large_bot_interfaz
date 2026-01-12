-- =============================================
-- Migration: Add Performance Indexes
-- Description: Optimizes queries for 2000+ conversations
-- Date: 2025-12-28
-- =============================================

-- =============================================
-- 1. INDEXES FOR CONVERSATIONS TABLE
-- =============================================

-- Index for filtering by status (active/archived)
CREATE INDEX IF NOT EXISTS idx_conversations_status 
ON conversations(status);

-- Index for filtering by AI enabled state
CREATE INDEX IF NOT EXISTS idx_conversations_ai_enabled 
ON conversations(ai_enabled);

-- Index for filtering by conversation state
CREATE INDEX IF NOT EXISTS idx_conversations_state 
ON conversations(conversation_state);

-- Composite index for common query: active conversations sorted by last message
CREATE INDEX IF NOT EXISTS idx_conversations_status_last_msg 
ON conversations(status, last_message_timestamp DESC NULLS LAST);

-- Composite index for searching by agent
CREATE INDEX IF NOT EXISTS idx_conversations_agent 
ON conversations(agent_id) 
WHERE agent_id IS NOT NULL;

-- =============================================
-- 2. INDEXES FOR MESSAGES TABLE
-- =============================================

-- Composite index for getting messages by conversation ordered by time
-- This is more efficient than separate indexes
CREATE INDEX IF NOT EXISTS idx_messages_conv_timestamp 
ON messages(conversation_phone, timestamp DESC);

-- Index for message status (pending, delivered, read, failed)
CREATE INDEX IF NOT EXISTS idx_messages_status 
ON messages(status);

-- Partial index for media messages only (saves space)
CREATE INDEX IF NOT EXISTS idx_messages_media 
ON messages(conversation_phone, timestamp DESC) 
WHERE media_type IS NOT NULL;

-- =============================================
-- 3. INDEXES FOR TAGS
-- =============================================

-- Index for faster tag lookups by conversation
CREATE INDEX IF NOT EXISTS idx_conversation_tags_phone 
ON conversation_tags(conversation_phone);

-- =============================================
-- 4. ANALYZE TABLES (Update statistics for query planner)
-- =============================================

ANALYZE conversations;
ANALYZE messages;
ANALYZE tags;
ANALYZE conversation_tags;

-- =============================================
-- VERIFICATION: Check indexes were created
-- =============================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

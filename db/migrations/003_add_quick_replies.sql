-- Add quick_replies table
CREATE TABLE IF NOT EXISTS quick_replies (
    id SERIAL PRIMARY KEY,
    shortcut VARCHAR(50) UNIQUE NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster search by shortcut
CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut);

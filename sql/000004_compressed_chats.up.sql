CREATE TABLE compressed_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,  -- timestamp of first message in the compressed range
    end_time DATETIME NOT NULL,    -- timestamp of last message in the compressed range
    summary TEXT NOT NULL,         -- compressed summary of the chat segment
    messages_count INTEGER NOT NULL, -- number of messages compressed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

ALTER TABLE chats ADD COLUMN last_uncompressed_message_id INTEGER DEFAULT NULL; 
-- Remove last_uncompressed_message_id from chats
ALTER TABLE chats DROP COLUMN last_uncompressed_message_id;

-- Drop compressed_chats table
DROP TABLE compressed_chats; 
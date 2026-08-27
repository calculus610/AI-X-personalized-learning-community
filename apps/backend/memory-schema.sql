CREATE TABLE IF NOT EXISTS memory_conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  scope_type VARCHAR(64) NOT NULL,
  scope_ref VARCHAR(128) NOT NULL,
  metadata_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_memory_conversations_user_scope (user_id, scope_type, scope_ref, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS memory_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  role VARCHAR(32) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  content_summary TEXT NULL,
  embedding JSON NULL,
  metadata_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  indexed_at DATETIME(3) NULL,
  INDEX idx_memory_messages_conversation (conversation_id, created_at),
  FULLTEXT KEY ft_memory_messages_content (content),
  CONSTRAINT fk_memory_messages_conversation FOREIGN KEY (conversation_id) REFERENCES memory_conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

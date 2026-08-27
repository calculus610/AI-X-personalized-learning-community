CREATE TABLE IF NOT EXISTS agent_profiles (
  id VARCHAR(96) NOT NULL PRIMARY KEY,
  agent_key VARCHAR(128) NOT NULL,
  name VARCHAR(190) NOT NULL,
  provider VARCHAR(64) NOT NULL DEFAULT 'fallback',
  app_key_ref VARCHAR(190) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_agent_key (agent_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_prompt_versions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(96) NOT NULL,
  prompt_version VARCHAR(64) NOT NULL,
  system_prompt TEXT NOT NULL,
  opening_message TEXT NOT NULL,
  output_format VARCHAR(64) NOT NULL DEFAULT 'markdown',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_agent_prompt_version (agent_id, prompt_version),
  CONSTRAINT fk_agent_prompt_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_course_bindings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  course_id VARCHAR(64) NULL,
  module_id VARCHAR(64) NULL,
  stage_id VARCHAR(128) NULL,
  agent_id VARCHAR(96) NOT NULL,
  prompt_version_id CHAR(36) NULL,
  knowledge_scope_id VARCHAR(128) NULL,
  priority INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_agent_binding_match (course_id, module_id, stage_id, status, priority),
  CONSTRAINT fk_agent_binding_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_agent_binding_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles(id),
  CONSTRAINT fk_agent_binding_prompt FOREIGN KEY (prompt_version_id) REFERENCES agent_prompt_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NOT NULL,
  path_id CHAR(36) NOT NULL,
  route_step_id CHAR(36) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  module_id VARCHAR(64) NOT NULL,
  stage_id VARCHAR(128) NULL,
  agent_id VARCHAR(96) NOT NULL,
  prompt_version_id CHAR(36) NULL,
  knowledge_scope_id VARCHAR(128) NULL,
  provider_conversation_id VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  stopped_at DATETIME(3) NULL,
  client_sent_at DATETIME(3) NULL,
  INDEX idx_agent_sessions_user_context (user_id, track_id, route_step_id, created_at),
  INDEX idx_agent_sessions_conversation (conversation_id),
  CONSTRAINT fk_agent_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_agent_sessions_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_agent_sessions_node FOREIGN KEY (route_step_id) REFERENCES learning_path_nodes(id),
  CONSTRAINT fk_agent_sessions_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_messages_index (
  id CHAR(36) NOT NULL PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  role VARCHAR(32) NOT NULL,
  memory_message_id CHAR(36) NOT NULL,
  provider_message_id VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'STORED',
  token_count INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  stopped_at DATETIME(3) NULL,
  INDEX idx_agent_messages_session (session_id, created_at),
  CONSTRAINT fk_agent_messages_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  CONSTRAINT fk_agent_messages_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  session_id CHAR(36) NOT NULL,
  event_name VARCHAR(96) NOT NULL,
  payload_json JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_agent_events_user_time (user_id, occurred_at),
  INDEX idx_agent_events_session (session_id, occurred_at),
  CONSTRAINT fk_agent_events_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_agent_events_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

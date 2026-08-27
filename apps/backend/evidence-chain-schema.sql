CREATE TABLE IF NOT EXISTS user_activity_sessions (
  id VARCHAR(128) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  tab_id VARCHAR(128) NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  client_started_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at DATETIME(3) NULL,
  active_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  idle_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  last_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_event_hash CHAR(64) NULL,
  PRIMARY KEY (user_id, id),
  INDEX idx_activity_sessions_user_time (user_id, started_at, last_seen_at),
  CONSTRAINT fk_activity_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_raw_interaction_events (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  client_event_id VARCHAR(128) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  tab_id VARCHAR(128) NULL,
  sequence_no BIGINT UNSIGNED NOT NULL,
  event_name VARCHAR(64) NOT NULL,
  page_path VARCHAR(500) NOT NULL,
  track_id CHAR(36) NULL,
  route_step_id CHAR(36) NULL,
  lesson_id BIGINT NULL,
  step_id BIGINT NULL,
  component_id VARCHAR(128) NULL,
  action_target VARCHAR(128) NULL,
  element_type VARCHAR(48) NULL,
  normalized_x DECIMAL(8,6) NULL,
  normalized_y DECIMAL(8,6) NULL,
  viewport_width INT UNSIGNED NULL,
  viewport_height INT UNSIGNED NULL,
  scroll_x INT NULL,
  scroll_y INT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_focused BOOLEAN NOT NULL DEFAULT TRUE,
  is_idle BOOLEAN NOT NULL DEFAULT FALSE,
  payload_json JSON NOT NULL,
  client_occurred_at DATETIME(3) NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  previous_event_hash CHAR(64) NULL,
  event_hash CHAR(64) NOT NULL,
  schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_raw_user_client_event (user_id, client_event_id),
  UNIQUE KEY uk_raw_session_sequence (user_id, session_id, sequence_no),
  INDEX idx_raw_user_time (user_id, occurred_at),
  INDEX idx_raw_context_time (user_id, track_id, route_step_id, occurred_at),
  CONSTRAINT fk_raw_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id CHAR(36) NOT NULL,
  admin_user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  target_user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  action_name VARCHAR(96) NOT NULL,
  request_id VARCHAR(128) NULL,
  payload_json JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_admin_audit_admin_time (admin_user_id, occurred_at),
  INDEX idx_admin_audit_target_time (target_user_id, occurred_at),
  CONSTRAINT fk_admin_audit_admin FOREIGN KEY (admin_user_id) REFERENCES users(id),
  CONSTRAINT fk_admin_audit_target FOREIGN KEY (target_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_integrity_heads (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  last_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_event_hash CHAR(64) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_integrity_head_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_export_audit_events (
  id CHAR(36) NOT NULL,
  actor_name VARCHAR(128) NOT NULL,
  target_user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  export_from DATETIME(3) NOT NULL,
  export_to DATETIME(3) NOT NULL,
  event_count INT UNSIGNED NOT NULL,
  export_sha256 CHAR(64) NOT NULL,
  output_reference VARCHAR(512) NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_internal_export_target_time (target_user_id, occurred_at),
  CONSTRAINT fk_internal_export_target FOREIGN KEY (target_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_integrity_records (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  sequence_no BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(48) NOT NULL,
  source_id CHAR(36) NOT NULL,
  canonical_payload_json JSON NOT NULL,
  previous_event_hash CHAR(64) NULL,
  event_hash CHAR(64) NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_integrity_user_sequence (user_id, sequence_no),
  UNIQUE KEY uk_integrity_source (source_type, source_id),
  INDEX idx_integrity_user_time (user_id, occurred_at),
  CONSTRAINT fk_integrity_record_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

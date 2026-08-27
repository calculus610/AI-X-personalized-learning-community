CREATE TABLE IF NOT EXISTS course_modules (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(64) NULL,
  color VARCHAR(32) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  module_id VARCHAR(64) NOT NULL,
  lesson_id BIGINT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NULL,
  content_version INT NOT NULL DEFAULT 1,
  is_selectable_target TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_courses_catalog (status, module_id, sort_order),
  CONSTRAINT fk_courses_module FOREIGN KEY (module_id) REFERENCES course_modules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_contents (
  course_id VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  content_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (course_id, version),
  CONSTRAINT fk_course_contents_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_tags (
  course_id VARCHAR(64) NOT NULL,
  tag_type VARCHAR(64) NOT NULL,
  tag_value VARCHAR(128) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  PRIMARY KEY (course_id, tag_type, tag_value),
  CONSTRAINT fk_course_tags_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_relations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  prerequisite_course_id VARCHAR(64) NOT NULL,
  target_course_id VARCHAR(64) NOT NULL,
  relation_type VARCHAR(64) NOT NULL DEFAULT 'REQUIRED_PREREQUISITE',
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_course_relation (prerequisite_course_id, target_course_id, relation_type),
  INDEX idx_relation_target (target_course_id, relation_type, status),
  CONSTRAINT fk_relation_prerequisite FOREIGN KEY (prerequisite_course_id) REFERENCES courses(id),
  CONSTRAINT fk_relation_target FOREIGN KEY (target_course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_tracks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  target_signature CHAR(64) NOT NULL,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_path_id CHAR(36) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_tracks_user (user_id, status, updated_at),
  CONSTRAINT fk_tracks_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS track_targets (
  track_id CHAR(36) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_id, course_id),
  CONSTRAINT fk_track_targets_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_track_targets_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS path_generation_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  track_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  error_code VARCHAR(128) NULL,
  error_message TEXT NULL,
  catalog_version VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  CONSTRAINT fk_tasks_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_paths (
  id CHAR(36) NOT NULL PRIMARY KEY,
  track_id CHAR(36) NOT NULL,
  version_number INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  catalog_version VARCHAR(64) NOT NULL,
  generated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_path_version (track_id, version_number),
  CONSTRAINT fk_paths_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_path_nodes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  path_id CHAR(36) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  module_id VARCHAR(64) NOT NULL,
  title_snapshot VARCHAR(500) NOT NULL,
  content_version INT NOT NULL,
  learning_level INT NOT NULL,
  sort_order INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  completed_at DATETIME(3) NULL,
  UNIQUE KEY uk_path_course (path_id, course_id),
  INDEX idx_path_nodes (path_id, module_id, learning_level, sort_order),
  CONSTRAINT fk_path_nodes_path FOREIGN KEY (path_id) REFERENCES learning_paths(id),
  CONSTRAINT fk_path_nodes_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_path_edges (
  id CHAR(36) NOT NULL PRIMARY KEY,
  path_id CHAR(36) NOT NULL,
  prerequisite_node_id CHAR(36) NOT NULL,
  target_node_id CHAR(36) NOT NULL,
  relation_type VARCHAR(64) NOT NULL,
  CONSTRAINT fk_path_edges_path FOREIGN KEY (path_id) REFERENCES learning_paths(id),
  CONSTRAINT fk_path_edges_source FOREIGN KEY (prerequisite_node_id) REFERENCES learning_path_nodes(id),
  CONSTRAINT fk_path_edges_target FOREIGN KEY (target_node_id) REFERENCES learning_path_nodes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_course_completions (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  content_version INT NOT NULL,
  completion_source VARCHAR(64) NOT NULL DEFAULT 'MANUAL_CONFIRM',
  completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, course_id),
  CONSTRAINT fk_completions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_completions_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NULL,
  path_id CHAR(36) NULL,
  event_name VARCHAR(96) NOT NULL,
  payload_json JSON NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_learning_events_user (user_id, occurred_at),
  CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_route_progress (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NOT NULL,
  active_step_index INT UNSIGNED NOT NULL DEFAULT 0,
  completed_step_ids JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, track_id),
  CONSTRAINT fk_route_progress_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_route_progress_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_course_progress (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NOT NULL,
  route_step_id CHAR(36) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  lesson_id BIGINT NOT NULL,
  support_mode VARCHAR(32) NULL,
  active_course_step_index INT UNSIGNED NOT NULL DEFAULT 0,
  completed_course_step_ids JSON NOT NULL,
  checklist_by_step JSON NOT NULL,
  stuck_step_ids JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, track_id, route_step_id),
  INDEX idx_course_progress_user_time (user_id, updated_at),
  CONSTRAINT fk_course_progress_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_course_progress_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_course_progress_node FOREIGN KEY (route_step_id) REFERENCES learning_path_nodes(id),
  CONSTRAINT fk_course_progress_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_evidence_files (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NOT NULL,
  route_step_id CHAR(36) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  lesson_id BIGINT NOT NULL,
  step_id BIGINT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(190) NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sha256 CHAR(64) NULL,
  object_key VARCHAR(1000) NULL,
  storage_status VARCHAR(32) NOT NULL DEFAULT 'STORED',
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_user_evidence_context (user_id, track_id, route_step_id, step_id, uploaded_at),
  CONSTRAINT fk_user_evidence_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_evidence_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_user_evidence_node FOREIGN KEY (route_step_id) REFERENCES learning_path_nodes(id),
  CONSTRAINT fk_user_evidence_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  aspiration TEXT NOT NULL,
  desired_skills TEXT NOT NULL,
  future_identity TEXT NOT NULL,
  selected_interest_ids JSON NOT NULL,
  primary_career_id VARCHAR(96) NULL,
  career_preference_updated_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profile_snapshots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  aspiration TEXT NOT NULL,
  desired_skills TEXT NOT NULL,
  future_identity TEXT NOT NULL,
  selected_interest_ids JSON NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'manual_edit',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_profile_snapshots_user (user_id, created_at),
  CONSTRAINT fk_profile_snapshots_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_learning_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  client_event_id VARCHAR(128) NULL,
  session_id VARCHAR(128) NULL,
  track_id CHAR(36) NULL,
  route_step_id CHAR(36) NULL,
  lesson_id BIGINT NULL,
  step_id BIGINT NULL,
  event_name VARCHAR(96) NOT NULL,
  payload_json JSON NOT NULL,
  client_occurred_at DATETIME(3) NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_user_client_event (user_id, client_event_id),
  INDEX idx_user_events_context (user_id, track_id, route_step_id, occurred_at),
  CONSTRAINT fk_user_events_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_events_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_user_events_node FOREIGN KEY (route_step_id) REFERENCES learning_path_nodes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS adaptive_quiz_attempts (
  id VARCHAR(128) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NOT NULL,
  route_step_id CHAR(36) NOT NULL,
  score INT UNSIGNED NOT NULL,
  total INT UNSIGNED NOT NULL,
  detail_json JSON NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, id),
  INDEX idx_adaptive_attempts_context (user_id, track_id, route_step_id, submitted_at),
  CONSTRAINT fk_adaptive_attempts_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_adaptive_attempts_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_adaptive_attempts_node FOREIGN KEY (route_step_id) REFERENCES learning_path_nodes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS adaptive_knowledge_mastery (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  knowledge_point_id VARCHAR(128) NOT NULL,
  knowledge_point_label VARCHAR(500) NOT NULL,
  score DECIMAL(8,6) NOT NULL DEFAULT 0,
  evidence_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, knowledge_point_id),
  CONSTRAINT fk_adaptive_mastery_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS adaptive_recommendations (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  track_id CHAR(36) NOT NULL,
  route_step_id CHAR(36) NOT NULL,
  recommendation_json JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, track_id, route_step_id),
  CONSTRAINT fk_adaptive_recommendations_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_adaptive_recommendations_track FOREIGN KEY (track_id) REFERENCES learning_tracks(id),
  CONSTRAINT fk_adaptive_recommendations_node FOREIGN KEY (route_step_id) REFERENCES learning_path_nodes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS legacy_user_data_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  source_type VARCHAR(64) NOT NULL,
  source_key VARCHAR(500) NOT NULL,
  payload_json JSON NOT NULL,
  import_status VARCHAR(32) NOT NULL,
  imported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_legacy_import (user_id, source_type, source_key),
  CONSTRAINT fk_legacy_import_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS legacy_user_identity_map (
  source_system VARCHAR(64) NOT NULL,
  legacy_identity VARCHAR(190) NOT NULL,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  username_snapshot VARCHAR(190) NULL,
  display_name_snapshot VARCHAR(190) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (source_system, legacy_identity),
  INDEX idx_legacy_identity_user (user_id),
  CONSTRAINT fk_legacy_identity_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

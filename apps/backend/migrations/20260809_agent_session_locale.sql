ALTER TABLE agent_sessions
  ADD COLUMN locale_code VARCHAR(8) NOT NULL DEFAULT 'zh' AFTER stage_id;

ALTER TABLE agent_sessions
  DROP INDEX idx_agent_sessions_user_context,
  ADD INDEX idx_agent_sessions_user_context (user_id, track_id, route_step_id, locale_code, created_at);

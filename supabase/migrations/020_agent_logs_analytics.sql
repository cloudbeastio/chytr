-- Analytics columns on agent_logs (Sprint 0: model, conversation_id)
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS conversation_id text;
CREATE INDEX IF NOT EXISTS idx_agent_logs_model ON agent_logs(model);
CREATE INDEX IF NOT EXISTS idx_agent_logs_conversation_id ON agent_logs(conversation_id);

-- New event types for hooks: preCompact, stop
ALTER TYPE log_event_type ADD VALUE 'pre_compact';
ALTER TYPE log_event_type ADD VALUE 'stop';

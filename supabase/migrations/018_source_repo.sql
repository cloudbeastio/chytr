ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS source_repo text;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS source_repo_name text;
CREATE INDEX IF NOT EXISTS idx_agent_logs_source_repo ON agent_logs(source_repo);

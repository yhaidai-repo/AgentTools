// The module owns its schema, so it can share a database with its host app without clashing.
export const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS agent_usage;

CREATE TABLE IF NOT EXISTS agent_usage.usage_record (
  run_id text PRIMARY KEY,
  labels jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  turns integer NOT NULL,
  outcome text NOT NULL,
  error text,
  input_tokens bigint NOT NULL,
  output_tokens bigint NOT NULL,
  cache_read_tokens bigint NOT NULL,
  cache_write_tokens bigint NOT NULL,
  cost_usd numeric(14, 6) NOT NULL,
  provider_cost_usd numeric(14, 6),
  models jsonb NOT NULL
);
ALTER TABLE agent_usage.usage_record ADD COLUMN IF NOT EXISTS subscription jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS usage_record_started_idx ON agent_usage.usage_record (started_at);
CREATE INDEX IF NOT EXISTS usage_record_labels_idx ON agent_usage.usage_record USING gin (labels);

CREATE TABLE IF NOT EXISTS agent_usage.run_event (
  run_id text NOT NULL,
  seq integer NOT NULL,
  at timestamptz NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, seq)
);
CREATE INDEX IF NOT EXISTS run_event_at_idx ON agent_usage.run_event (at);

CREATE TABLE IF NOT EXISTS agent_usage.subscription_snapshot (
  provider text PRIMARY KEY,
  plan text,
  windows jsonb NOT NULL,
  checked_at timestamptz NOT NULL,
  unavailable text
);
`;

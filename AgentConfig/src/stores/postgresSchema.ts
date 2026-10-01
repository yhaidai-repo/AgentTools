// Own schema, so the module can share a database with its host app.
export const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS agent_config;

CREATE TABLE IF NOT EXISTS agent_config.agent (
  id text PRIMARY KEY,
  definition jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_config.global (
  id smallint PRIMARY KEY CHECK (id = 1),
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

export const CHANGE_CHANNEL = "agent_config_changed";

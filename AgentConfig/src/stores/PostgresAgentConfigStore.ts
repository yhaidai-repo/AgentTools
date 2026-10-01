import type { Pool } from "pg";
import { FALLBACK_GLOBAL, mergeGlobal, mergeWithDefaults } from "../defaults";
import type { AgentConfigStore } from "../models/AgentConfigStore";
import type { AgentDefinition } from "../models/AgentDefinition";
import type { AgentsGlobal } from "../models/AgentsGlobal";
import type { ConfigChange } from "../models/ConfigChange";
import { validateAgent, validateGlobal } from "../schemas";
import { CHANGE_CHANNEL, SCHEMA_SQL } from "./postgresSchema";

// Saves notify every listener over LISTEN/NOTIFY, so a change from any client reaches the host at once.
export class PostgresAgentConfigStore implements AgentConfigStore {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async ensureDefaults(agents: AgentDefinition[], global: AgentsGlobal): Promise<void> {
    for (const defaults of agents) {
      const stored = await this.get(defaults.id);

      await this.write(mergeWithDefaults(stored ?? {}, defaults));
    }

    await this.writeGlobal(mergeGlobal(await this.readGlobal(), global));

    // Announced like a save: hosts that started first (e.g. a scheduler) would otherwise miss newly added agents.
    await this.notify({ kind: "global", id: null });
  }

  async list(): Promise<AgentDefinition[]> {
    const result = await this.pool.query("SELECT definition FROM agent_config.agent ORDER BY id");

    return result.rows.map((row) => row.definition as AgentDefinition);
  }

  async get(id: string): Promise<AgentDefinition | null> {
    const result = await this.pool.query("SELECT definition FROM agent_config.agent WHERE id = $1", [id]);

    return (result.rows[0]?.definition as AgentDefinition | undefined) ?? null;
  }

  async save(agent: AgentDefinition): Promise<void> {
    const checked = validateAgent(agent);

    if (!checked.ok) {
      throw new Error(`Invalid agent definition: ${checked.errors.join("; ")}`);
    }

    await this.write(checked.value);
    await this.notify({ kind: "agent", id: checked.value.id });
  }

  async getGlobal(): Promise<AgentsGlobal> {
    return mergeGlobal(await this.readGlobal(), FALLBACK_GLOBAL);
  }

  async saveGlobal(global: AgentsGlobal): Promise<void> {
    const checked = validateGlobal(global);

    if (!checked.ok) {
      throw new Error(`Invalid global agent settings: ${checked.errors.join("; ")}`);
    }

    await this.writeGlobal(checked.value);
    await this.notify({ kind: "global", id: null });
  }

  async onChange(listener: (change: ConfigChange) => void): Promise<() => Promise<void>> {
    const client = await this.pool.connect();

    client.on("notification", (message) => listener(JSON.parse(message.payload ?? "{}") as ConfigChange));
    await client.query(`LISTEN ${CHANGE_CHANNEL}`);

    return async () => {
      await client.query(`UNLISTEN ${CHANGE_CHANNEL}`);
      client.release();
    };
  }

  private async write(agent: AgentDefinition): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_config.agent (id, definition) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET definition = excluded.definition, updated_at = now()`,
      [agent.id, JSON.stringify(agent)],
    );
  }

  private async readGlobal(): Promise<Partial<AgentsGlobal> | null> {
    const result = await this.pool.query("SELECT value FROM agent_config.global WHERE id = 1");

    return (result.rows[0]?.value as Partial<AgentsGlobal> | undefined) ?? null;
  }

  private async writeGlobal(global: AgentsGlobal): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_config.global (id, value) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET value = excluded.value, updated_at = now()`,
      [JSON.stringify(global)],
    );
  }

  private async notify(change: ConfigChange): Promise<void> {
    await this.pool.query("SELECT pg_notify($1, $2)", [CHANGE_CHANNEL, JSON.stringify(change)]);
  }
}

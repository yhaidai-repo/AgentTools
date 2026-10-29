import type { Pool } from "pg";
import { FALLBACK_GLOBAL, mergeGlobal, refreshSystemAgent, refreshUserAgents } from "../defaults";
import { logFrameworkRefresh, logRefresh, shippedSkillNames } from "../shippedRefreshLog";
import type { AgentConfigStore } from "../models/AgentConfigStore";
import type { AgentDefinition } from "../models/AgentDefinition";
import type { AgentsGlobal } from "../models/AgentsGlobal";
import type { ConfigChange } from "../models/ConfigChange";
import { isRemovable } from "../removable";
import { validateAgent, validateGlobal } from "../schemas";
import { CHANGE_CHANNEL, SCHEMA_SQL } from "./postgresSchema";

// Saves notify every listener over LISTEN/NOTIFY, so a change from any client reaches the host at once.
export class PostgresAgentConfigStore implements AgentConfigStore {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async ensureDefaults(agents: AgentDefinition[], global: AgentsGlobal): Promise<void> {
    const shippedSkills = shippedSkillNames(agents);

    for (const defaults of agents) {
      const refresh = refreshSystemAgent((await this.get(defaults.id)) ?? {}, defaults, shippedSkills);

      logRefresh(refresh);
      await this.write(refresh.agent);
    }

    for (const agent of refreshUserAgents(await this.list(), agents)) {
      await this.write(agent);
    }

    const stored = await this.readGlobal();
    const merged = mergeGlobal(stored, global);

    logFrameworkRefresh(stored, merged);
    await this.writeGlobal(merged);

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

  async saveIfUnchanged(current: AgentDefinition, next: AgentDefinition): Promise<boolean> {
    const checked = validateAgent(next);
    if (!checked.ok) throw new Error(`Invalid agent definition: ${checked.errors.join("; ")}`);
    const result = await this.pool.query(
      "UPDATE agent_config.agent SET definition = $3::jsonb, updated_at = now() WHERE id = $1 AND definition = $2::jsonb RETURNING id",
      [current.id, JSON.stringify(current), JSON.stringify(checked.value)],
    );
    if (result.rows.length === 0) return false;
    await this.notify({ kind: "agent", id: next.id });
    return true;
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

  async remove(id: string): Promise<void> {
    const agent = await this.get(id);

    if (!agent) {
      return;
    }

    if (!isRemovable(agent)) {
      throw new Error(`Agent "${id}" is shipped with the code and can't be deleted.`);
    }

    await this.pool.query("DELETE FROM agent_config.agent WHERE id = $1", [id]);
    await this.notify({ kind: "agent", id });
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

import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { FALLBACK_GLOBAL, mergeGlobal, mergeWithDefaults, refreshUserAgents } from "../defaults";
import type { AgentConfigStore } from "../models/AgentConfigStore";
import type { AgentDefinition } from "../models/AgentDefinition";
import type { AgentsGlobal } from "../models/AgentsGlobal";
import type { ConfigChange } from "../models/ConfigChange";
import { isRemovable } from "../removable";
import { validateAgent, validateGlobal } from "../schemas";

interface ConfigFile {
  global: Partial<AgentsGlobal> | null;
  agents: Record<string, AgentDefinition>;
}

// One JSON file, for hosts without a database; edits to the file by hand are picked up as changes.
export class JsonFileAgentConfigStore implements AgentConfigStore {
  constructor(private readonly path: string) {}

  async ensureDefaults(agents: AgentDefinition[], global: AgentsGlobal): Promise<void> {
    const file = await this.read();
    const merged = [...agents.map((defaults) => mergeWithDefaults(file.agents[defaults.id] ?? {}, defaults)), ...refreshUserAgents(Object.values(file.agents), agents)];

    await this.write({
      global: mergeGlobal(file.global, global),
      agents: { ...file.agents, ...Object.fromEntries(merged.map((agent) => [agent.id, agent])) },
    });
  }

  async list(): Promise<AgentDefinition[]> {
    return Object.values((await this.read()).agents).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<AgentDefinition | null> {
    return (await this.read()).agents[id] ?? null;
  }

  async save(agent: AgentDefinition): Promise<void> {
    const checked = validateAgent(agent);

    if (!checked.ok) {
      throw new Error(`Invalid agent definition: ${checked.errors.join("; ")}`);
    }

    const file = await this.read();

    await this.write({ ...file, agents: { ...file.agents, [agent.id]: checked.value } });
  }

  async remove(id: string): Promise<void> {
    const file = await this.read();
    const agent = file.agents[id];

    if (!agent) {
      return;
    }

    if (!isRemovable(agent)) {
      throw new Error(`Agent "${id}" is shipped with the code and can't be deleted.`);
    }

    const { [id]: _removed, ...agents } = file.agents;

    await this.write({ ...file, agents });
  }

  async getGlobal(): Promise<AgentsGlobal> {
    return mergeGlobal((await this.read()).global, FALLBACK_GLOBAL);
  }

  async saveGlobal(global: AgentsGlobal): Promise<void> {
    const checked = validateGlobal(global);

    if (!checked.ok) {
      throw new Error(`Invalid global agent settings: ${checked.errors.join("; ")}`);
    }

    await this.write({ ...(await this.read()), global: checked.value });
  }

  async onChange(listener: (change: ConfigChange) => void): Promise<() => Promise<void>> {
    const watcher = watch(this.path, () => listener({ kind: "global", id: null }));

    return async () => watcher.close();
  }

  private async read(): Promise<ConfigFile> {
    const text = await readFile(this.path, "utf8").catch(() => null);

    return text ? (JSON.parse(text) as ConfigFile) : { global: null, agents: {} };
  }

  private async write(file: ConfigFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(file, null, 2), "utf8");
  }
}

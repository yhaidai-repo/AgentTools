import { watch } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { FALLBACK_GLOBAL, mergeGlobal, mergeWithDefaults, refreshUserAgents } from "../defaults";
import type { AgentConfigStore } from "../models/AgentConfigStore";
import type { AgentDefinition } from "../models/AgentDefinition";
import type { AgentsGlobal } from "../models/AgentsGlobal";
import type { ConfigChange } from "../models/ConfigChange";
import { isRemovable } from "../removable";
import { shippedSkillNames } from "../shippedRefreshLog";
import { validateAgent, validateGlobal } from "../schemas";

interface ConfigFile {
  global: Partial<AgentsGlobal> | null;
  agents: Record<string, AgentDefinition>;
}

// Serializes instances using the same filename within this process; independent processes need a database store.
const mutations = new Map<string, Promise<void>>();

// One JSON file, for hosts without a database; edits to the file by hand are picked up as changes.
export class JsonFileAgentConfigStore implements AgentConfigStore {
  constructor(private readonly path: string) {}

  async ensureDefaults(agents: AgentDefinition[], global: AgentsGlobal): Promise<void> {
    await this.mutate((file) => {
      const shippedSkills = shippedSkillNames(agents);
      const merged = [...agents.map((defaults) => mergeWithDefaults(file.agents[defaults.id] ?? {}, defaults, shippedSkills)), ...refreshUserAgents(Object.values(file.agents), agents)];

      return {
        global: mergeGlobal(file.global, global),
        agents: { ...file.agents, ...Object.fromEntries(merged.map((agent) => [agent.id, agent])) },
      };
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

    await this.mutate((file) => ({ ...file, agents: { ...file.agents, [agent.id]: checked.value } }));
  }

  async remove(id: string): Promise<void> {
    await this.mutate((file) => {
      const agent = file.agents[id];

      if (!agent) {
        return null;
      }

      if (!isRemovable(agent)) {
        throw new Error(`Agent "${id}" is shipped with the code and can't be deleted.`);
      }

      const { [id]: _removed, ...agents } = file.agents;

      return { ...file, agents };
    });
  }

  async getGlobal(): Promise<AgentsGlobal> {
    return mergeGlobal((await this.read()).global, FALLBACK_GLOBAL);
  }

  async saveGlobal(global: AgentsGlobal): Promise<void> {
    const checked = validateGlobal(global);

    if (!checked.ok) {
      throw new Error(`Invalid global agent settings: ${checked.errors.join("; ")}`);
    }

    await this.mutate((file) => ({ ...file, global: checked.value }));
  }

  async onChange(listener: (change: ConfigChange) => void): Promise<() => Promise<void>> {
    await mkdir(dirname(this.path), { recursive: true });
    // Watch the directory so atomic replacement does not leave the watcher attached to the old inode.
    const watcher = watch(dirname(this.path), (_event, filename) => {
      if (filename === null || filename.toString() === basename(this.path)) {
        listener({ kind: "global", id: null });
      }
    });

    return async () => watcher.close();
  }

  private async read(): Promise<ConfigFile> {
    const text = await readFile(this.path, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    return text ? (JSON.parse(text) as ConfigFile) : { global: null, agents: {} };
  }

  private async write(file: ConfigFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporary, JSON.stringify(file, null, 2), { encoding: "utf8", flag: "wx" });
      await replaceFile(temporary, this.path);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  private async mutate(update: (file: ConfigFile) => ConfigFile | null): Promise<void> {
    const absolute = resolve(this.path);
    const key = process.platform === "win32" ? absolute.toLowerCase() : absolute;
    const current = (mutations.get(key) ?? Promise.resolve()).then(async () => {
      const next = update(await this.read());
      if (next) await this.write(next);
    });
    const tail = current.catch(() => undefined);
    mutations.set(key, tail);

    try {
      await current;
    } finally {
      if (mutations.get(key) === tail) mutations.delete(key);
    }
  }
}

async function replaceFile(temporary: string, path: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows readers and scanners may briefly hold the old file without delete sharing.
      if (process.platform !== "win32" || !["EACCES", "EPERM", "EBUSY"].includes(code ?? "") || attempt >= 6) throw error;
      await delay(10 * 2 ** attempt);
    }
  }
}

import type { AgentDefinition } from "./AgentDefinition";
import type { AgentsGlobal } from "./AgentsGlobal";
import type { ConfigChange } from "./ConfigChange";

// Any client (web UI, CLI, another app) reads and changes agent configuration through this interface.
export interface AgentConfigStore {
  /** Inserts missing agents and fills fields added in newer defaults; never overwrites saved values. */
  ensureDefaults(agents: AgentDefinition[], global: AgentsGlobal): Promise<void>;
  list(): Promise<AgentDefinition[]>;
  get(id: string): Promise<AgentDefinition | null>;
  /** Validates, saves and notifies listeners. Throws on invalid input. */
  save(agent: AgentDefinition): Promise<void>;
  getGlobal(): Promise<AgentsGlobal>;
  saveGlobal(global: AgentsGlobal): Promise<void>;
  /** Calls `listener` on every change, from any client. Returns an unsubscribe function. */
  onChange(listener: (change: ConfigChange) => void): Promise<() => Promise<void>>;
}

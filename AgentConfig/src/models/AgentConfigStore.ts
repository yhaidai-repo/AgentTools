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
  /** Optional optimistic save for shared stores: false if another writer changed the definition since it was read. */
  saveIfUnchanged?(current: AgentDefinition, next: AgentDefinition): Promise<boolean>;
  /** Deletes an agent created in the UI and notifies listeners; a built-in agent is refused. */
  remove(id: string): Promise<void>;
  getGlobal(): Promise<AgentsGlobal>;
  saveGlobal(global: AgentsGlobal): Promise<void>;
  /** Calls `listener` on every change, from any client. Returns an unsubscribe function. */
  onChange(listener: (change: ConfigChange) => void): Promise<() => Promise<void>>;
}

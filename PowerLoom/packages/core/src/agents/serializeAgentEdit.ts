import type { AgentConfigStore } from "@agenttools/config";

const pending = new WeakMap<AgentConfigStore, Map<string, Promise<void>>>();

// Local stores have no database CAS. Queue edits per store/agent, including the initial read. Shared
// Postgres stores additionally compare the full definition on save to catch other processes' edits.
export async function serializeAgentEdit<T>(store: AgentConfigStore, id: string, edit: () => Promise<T>): Promise<T> {
  let queue = pending.get(store);
  if (!queue) { queue = new Map(); pending.set(store, queue); }
  const before = queue.get(id) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  queue.set(id, current);
  await before;
  try {
    return await edit();
  } finally {
    release();
    if (queue.get(id) === current) queue.delete(id);
  }
}

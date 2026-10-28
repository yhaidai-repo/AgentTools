import type { AgentConfigStore } from "@agenttools/config";

// Built-in agents a newer one replaced: design, replaced by planning (user decision 2026-10-28). Their stored definitions
// stay for the runs that name them, but switched off, so they never take the task types their successor took over.
export const RETIRED_AGENT_IDS = ["design"];

export async function disableRetiredAgents(store: Pick<AgentConfigStore, "get" | "save">, ids: string[]): Promise<void> {
  for (const id of ids) {
    await disableRetired(store, id);
  }
}

async function disableRetired(store: Pick<AgentConfigStore, "get" | "save">, id: string): Promise<void> {
  const stored = await store.get(id);

  if (!stored?.enabled) {
    return;
  }

  await store.save({ ...stored, enabled: false, handles: [] });
}

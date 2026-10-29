import type { AgentConfigStore } from "@agenttools/config";

// Agents this release doesn't ship: planning and implementation are still piloted on their branch (release decision
// 2026-10-29), and design keeps the design tasks. A database that ran the pilot keeps their stored definitions for the
// runs that name them, but switched off, so they never take design or implement tasks here.
export const RETIRED_AGENT_IDS = ["planning", "implementation"];

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

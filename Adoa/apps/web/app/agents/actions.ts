"use server";

import { revalidatePath } from "next/cache";
import { getAgentConfig } from "@/lib/agentConfig";
import { getBoss } from "@/lib/boss";
import type { ActionResult } from "@/models/ActionResult";

// Kill switch through AgentConfig; resuming also clears a rate-limit pause.
export async function setAgentsPaused(paused: boolean): Promise<ActionResult> {
  const store = getAgentConfig();
  const global = await store.getGlobal();

  await store.saveGlobal({ ...global, paused, pausedUntil: paused ? global.pausedUntil : null });
  revalidatePath("/agents");

  return { ok: true, message: paused ? "All agents paused." : "Agents resumed." };
}

// Agent queues are named after the agent id.
export async function runAgentNow(agentId: string): Promise<ActionResult> {
  const agent = await getAgentConfig().get(agentId);

  if (!agent) {
    return { ok: false, message: "Unknown agent." };
  }

  const jobId = await (await getBoss()).send(agent.id);

  if (!jobId) {
    return { ok: true, message: `A ${agent.label} batch is already queued or running.` };
  }

  return { ok: true, message: `${agent.label} batch queued. Refresh in a minute.` };
}

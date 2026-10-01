"use server";

import { DISPATCH_QUEUE, type DispatchJob } from "@adoa/core";
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

// Same as the agent's schedule: the worker validates the agent's open tasks and starts the valid ones.
export async function runAgentNow(agentId: string): Promise<ActionResult> {
  const agent = await getAgentConfig().get(agentId);

  if (!agent) {
    return { ok: false, message: "Unknown agent." };
  }

  const job: DispatchJob = { agentId: agent.id };

  await (await getBoss()).send(DISPATCH_QUEUE, job);

  return { ok: true, message: `${agent.label}: its open tasks are being checked and started. Held tasks show their reasons on the PBI page.` };
}

"use server";

import { pauseAgentsCommand, runAgentCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// Kill switch through agent.pause (the command a chat uses too); resuming also clears a rate-limit pause.
export async function setAgentsPaused(paused: boolean): Promise<ActionResult> {
  const changed = await runWebCommand(pauseAgentsCommand, { paused });

  if (!changed.ok) {
    return { ok: false, message: changed.error };
  }

  revalidatePath("/agents");

  return { ok: true, message: paused ? "All agents paused." : "Agents resumed." };
}

// A dead letter put back on its queue (PowerLoom's durability agent picks it up), or dropped for good.
export async function replayDeadLetter(id: string): Promise<ActionResult> {
  const replayed = await powerloom.POST("/api/dead-letters/{id}/replay", { params: { path: { id } } });

  revalidatePath("/agents");

  return powerloomResult(replayed, "Replayed: it runs again in a moment.");
}

export async function discardDeadLetter(id: string): Promise<ActionResult> {
  const discarded = await powerloom.DELETE("/api/dead-letters/{id}", { params: { path: { id } } });

  revalidatePath("/agents");

  return powerloomResult(discarded, "Discarded.");
}

// Same as the agent's schedule: PowerLoom validates the agent's open tasks and starts the valid ones.
export async function runAgentNow(agentId: string): Promise<ActionResult> {
  const dispatched = await runWebCommand(runAgentCommand, { id: agentId });

  return dispatched.ok ? { ok: true, message: `${dispatched.value.message} Held tasks show their reasons on the PBI page.` } : { ok: false, message: dispatched.error };
}

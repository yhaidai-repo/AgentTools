"use server";

import { discardDeadLetterCommand, pauseAgentsCommand, replayDeadLetterCommand, runAgentCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import type { ActionResult } from "@/models/ActionResult";
import { messageResult } from "@/lib/messageResult";

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
  const replayed = await runWebCommand(replayDeadLetterCommand, { id });

  revalidatePath("/agents");

  return replayed.ok ? { ok: true, message: "Replayed: it runs again in a moment." } : { ok: false, message: replayed.error };
}

export async function discardDeadLetter(id: string): Promise<ActionResult> {
  const discarded = await runWebCommand(discardDeadLetterCommand, { id });

  revalidatePath("/agents");

  return discarded.ok ? { ok: true, message: "Discarded." } : { ok: false, message: discarded.error };
}

// Same as the agent's schedule: PowerLoom validates the agent's open tasks and starts the valid ones.
export async function runAgentNow(agentId: string): Promise<ActionResult> {
  const dispatched = await runWebCommand(runAgentCommand, { id: agentId });

  return messageResult(dispatched);
}

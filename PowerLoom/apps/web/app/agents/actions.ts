"use server";

import { pauseAgentsCommand, runAgentCommand } from "@powerloom/core";
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

// Same as the agent's schedule: PowerLoom validates the agent's open tasks and starts the valid ones.
export async function runAgentNow(agentId: string): Promise<ActionResult> {
  const dispatched = await runWebCommand(runAgentCommand, { id: agentId });

  return messageResult(dispatched);
}

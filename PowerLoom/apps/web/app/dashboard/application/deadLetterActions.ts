"use server";

import { discardDeadLetterCommand, replayDeadLetterCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import type { ActionResult } from "@/models/ActionResult";

// A dead letter put back on its queue, or dropped for good; refresh the dashboard's queue and health counts.
export async function replayDeadLetter(id: string): Promise<ActionResult> {
  const replayed = await runWebCommand(replayDeadLetterCommand, { id });

  revalidatePath("/dashboard");

  return replayed.ok ? { ok: true, message: "Replayed: it runs again in a moment." } : { ok: false, message: replayed.error };
}

export async function discardDeadLetter(id: string): Promise<ActionResult> {
  const discarded = await runWebCommand(discardDeadLetterCommand, { id });

  revalidatePath("/dashboard");

  return discarded.ok ? { ok: true, message: "Discarded." } : { ok: false, message: discarded.error };
}

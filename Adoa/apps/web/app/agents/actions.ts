"use server";

import { REFINEMENT_QUEUE, readAgentSettings, saveAgentSettings } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import type { ActionResult } from "@/models/ActionResult";

// Kill switch: also clears a rate-limit pause on resume.
export async function setAgentsPaused(paused: boolean): Promise<ActionResult> {
  const settings = await readAgentSettings(getDb());

  await saveAgentSettings(getDb(), { ...settings, paused, pausedUntil: paused ? settings.pausedUntil : null });
  revalidatePath("/agents");

  return { ok: true, message: paused ? "All agents paused." : "Agents resumed." };
}

export async function runRefinementNow(): Promise<ActionResult> {
  const jobId = await (await getBoss()).send(REFINEMENT_QUEUE);

  if (!jobId) {
    return { ok: true, message: "A refinement batch is already queued or running." };
  }

  return { ok: true, message: "Refinement batch queued. Refresh in a minute." };
}

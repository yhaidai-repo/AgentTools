"use server";

import { VAULT_REVIEW_AGENT, VAULT_TRASH_QUEUE, applyTaskSchedule, deleteTaskSchedule, saveTaskSchedule, type VaultTrashJob } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { bossJobPort } from "@/lib/jobPort";
import type { ActionResult } from "@/models/ActionResult";

const TRASH_WAIT_MS = 15_000;

// Restore or delete a trashed note through the worker (the web's vault mount is read-only); the page waits for it.
export async function trashAction(path: string, action: VaultTrashJob["action"]): Promise<ActionResult> {
  const job: VaultTrashJob = { vault: await requireVault(), path, action };
  const done = await bossJobPort.sendAndWait(VAULT_TRASH_QUEUE, job, TRASH_WAIT_MS);

  revalidatePath("/vault");

  return done ? { ok: true, message: `${path} ${action === "restore" ? "restored" : "deleted"}.` } : { ok: false, message: `${path}: the worker didn't ${action} it (see Job errors on the Agents page).` };
}

// Picks up open review tasks weekly; the agent's own schedule says when it runs them.
const DEFAULT_REVIEW_CRON = "0 6 * * 1";

// The vault review is scheduled from the vault's Maintenance tab (user decision 2026-10-06): one schedule for the
// selected vault with defaults, edited like any scheduled task afterwards.
export async function addVaultReviewScheduleAction(): Promise<ActionResult> {
  const vault = await requireVault();
  const saved = await saveTaskSchedule(getDb(), { id: null, name: `Vault review of ${vault}`, agentId: VAULT_REVIEW_AGENT, vault, cron: DEFAULT_REVIEW_CRON, enabled: true, params: {} });

  if (!saved.ok) {
    return { ok: false, message: saved.error };
  }

  try {
    await applyTaskSchedule(await getBoss(), saved.value);
  } catch (error) {
    await deleteTaskSchedule(getDb(), saved.value.id);

    return { ok: false, message: `Not scheduled: ${error instanceof Error ? error.message : String(error)}` };
  }

  revalidatePath("/vault");

  return { ok: true, message: `Scheduled: ${saved.value.name}, ${DEFAULT_REVIEW_CRON}.` };
}

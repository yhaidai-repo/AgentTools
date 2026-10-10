"use server";

import { VAULT_REVIEW_AGENT } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { requireVault } from "@/lib/currentVault";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";
import type { TrashAction } from "@/models/TrashAction";

// Restore or delete a trashed note through PowerLoom (the web's vault mount is read-only); the page waits for it.
export async function trashAction(path: string, action: TrashAction): Promise<ActionResult> {
  const vault = await requireVault();
  const request = { params: { path: { vault } }, body: { path } };
  const result = action === "restore"
    ? powerloomResult(await powerloom.POST("/api/vaults/{vault}/trash/restore", request), `${path} restored.`)
    : powerloomResult(await powerloom.DELETE("/api/vaults/{vault}/trash", request), `${path} deleted.`);

  revalidatePath("/vault");

  return result;
}

// Picks up open review tasks weekly; the agent's own schedule says when it runs them.
const DEFAULT_REVIEW_CRON = "0 6 * * 1";

// The vault review is scheduled from the vault's Maintenance tab (user decision 2026-10-06): one schedule for the
// selected vault with defaults, edited like any scheduled task afterwards.
export async function addVaultReviewScheduleAction(): Promise<ActionResult> {
  const vault = await requireVault();
  const name = `Vault review of ${vault}`;
  const saved = await powerloom.PUT("/api/task-schedules", { body: { id: null, name, agentId: VAULT_REVIEW_AGENT, vault, cron: DEFAULT_REVIEW_CRON, enabled: true, goal: null, repos: null } });

  revalidatePath("/vault");

  return powerloomResult(saved, `Scheduled: ${name}, ${DEFAULT_REVIEW_CRON}.`);
}

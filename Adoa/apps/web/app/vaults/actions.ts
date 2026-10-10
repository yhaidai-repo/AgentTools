"use server";

import { applyVaultJobSchedules } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";
import type { AddVaultResult } from "@/models/AddVaultResult";

// PowerLoom adds the vault and prepares its folder and files (adoa's templates); the page waits for it.
export async function addVaultAction(_previous: AddVaultResult | null, form: FormData): Promise<AddVaultResult> {
  const added = await powerloom.POST("/api/vaults", { body: { folder: String(form.get("folder") ?? "") } });
  const result = powerloomResult(added, "");

  if (!result.ok || !added.data) {
    return { ...result, vault: null };
  }

  revalidatePath("/", "layout");

  return { ok: true, vault: added.data.vault, message: `${added.data.vault} added, its folder and files prepared (${added.data.created.length} created). Configure it for your agent app from the Vault menu; its features are off.` };
}

// PowerLoom forgets the vault (its folder and history stay); pg-boss drops the vault's schedules until the worker's
// jobs move to PowerLoom too.
export async function removeVaultAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = String(form.get("vault") ?? "");
  const result = powerloomResult(await powerloom.DELETE("/api/vaults/{vault}", { params: { path: { vault } } }), `${vault} removed. Its folder is untouched.`);

  if (result.ok) {
    await applyVaultJobSchedules(await getBoss(), getDb());
  }

  revalidatePath("/", "layout");

  return result;
}

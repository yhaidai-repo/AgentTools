"use server";

import { VAULT_INIT_QUEUE, addVault, applyVaultJobSchedules, removeVault, vaultFolderName, type VaultJob } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import { bossJobPort } from "@/lib/jobPort";
import { vaultsHostRoot } from "@/lib/obsidian";
import type { ActionResult } from "@/models/ActionResult";
import type { AddVaultResult } from "@/models/AddVaultResult";

const INIT_WAIT_MS = 15_000;

export async function addVaultAction(_previous: AddVaultResult | null, form: FormData): Promise<AddVaultResult> {
  const name = vaultFolderName(String(form.get("folder") ?? ""), vaultsHostRoot());

  if (!name.ok) {
    return { ok: false, message: name.error, vault: null };
  }

  const added = await addVault(getDb(), name.value);

  if (!added.ok) {
    return { ok: false, message: added.error, vault: null };
  }

  const prepared = await prepareVaultFolder(added.value.name);

  revalidatePath("/", "layout");

  return { ok: true, vault: added.value.name, message: `${added.value.name} added${prepared ? ", its folder and files prepared" : " (the worker didn't prepare its folder: see Job errors on the Agents page)"}. Configure it for your agent app from the Vault menu; its features are off.` };
}

// The worker creates the folder and the files adoa's maintenance needs (user decision 2026-10-05); the page waits for it.
async function prepareVaultFolder(vault: string): Promise<boolean> {
  const job: VaultJob = { vault };

  return bossJobPort.sendAndWait(VAULT_INIT_QUEUE, job, INIT_WAIT_MS);
}

export async function removeVaultAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const removed = await removeVault(getDb(), String(form.get("vault") ?? ""));

  if (removed.ok) {
    await applyVaultJobSchedules(await getBoss(), getDb());
  }

  revalidatePath("/", "layout");

  return removed.ok ? { ok: true, message: `${removed.value} removed. Its folder is untouched.` } : { ok: false, message: removed.error };
}

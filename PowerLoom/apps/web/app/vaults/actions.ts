"use server";

import { addVaultCommand, removeVaultCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import type { ActionResult } from "@/models/ActionResult";
import type { AddVaultResult } from "@/models/AddVaultResult";
import { messageResult } from "@/lib/messageResult";

// PowerLoom adds the vault and prepares its folder and files (PowerLoom's templates); the page waits for it.
export async function addVaultAction(_previous: AddVaultResult | null, form: FormData): Promise<AddVaultResult> {
  const added = await runWebCommand(addVaultCommand, { folder: String(form.get("folder") ?? "") });

  if (!added.ok) {
    return { ok: false, message: added.error, vault: null };
  }

  revalidatePath("/", "layout");

  return { ok: true, vault: added.value.vault, message: `${added.value.vault} added, its folder and files prepared (${added.value.created.length} created). Configure it for your agent app from the Vault menu; its features are off.` };
}

// PowerLoom forgets the vault (its folder and history stay) and stops its schedules.
export async function removeVaultAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const removed = await runWebCommand(removeVaultCommand, { vault: String(form.get("vault") ?? "") });

  revalidatePath("/", "layout");

  return messageResult(removed);
}

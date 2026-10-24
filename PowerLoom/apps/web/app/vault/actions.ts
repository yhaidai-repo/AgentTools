"use server";

import { deleteTrashCommand, restoreTrashCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import { requireVault } from "@/lib/currentVault";
import type { ActionResult } from "@/models/ActionResult";
import type { TrashAction } from "@/models/TrashAction";

// Restore or delete a trashed note through PowerLoom (the web's vault mount is read-only); the page waits for it.
export async function trashAction(path: string, action: TrashAction): Promise<ActionResult> {
  const input = { vault: await requireVault(), path };
  const done = action === "restore" ? await runWebCommand(restoreTrashCommand, input) : await runWebCommand(deleteTrashCommand, input);

  revalidatePath("/vault");

  return done.ok ? { ok: true, message: `${path} ${action === "restore" ? "restored" : "deleted"}.` } : { ok: false, message: done.error };
}

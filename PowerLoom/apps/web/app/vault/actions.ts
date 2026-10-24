"use server";

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

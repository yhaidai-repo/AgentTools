"use server";

import { revalidatePath } from "next/cache";
import { requireVault } from "@/lib/currentVault";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// Google Drive (user decision 2026-10-25), kept by PowerLoom: the vault's switch and OAuth client (an empty secret keeps
// the saved one), sign out, and the folders agents may read. The sign-in itself is the google-drive routes'.
export async function saveGoogleDriveAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = form.get("enabled") === "on";
  const saved = await powerloom.PUT("/api/vaults/{vault}/google-drive", {
    params: { path: { vault: await requireVault() } },
    body: { enabled, clientId: text(form, "clientId") || null, clientSecret: text(form, "clientSecret") || null },
  });

  revalidatePath("/settings");

  return powerloomResult(saved, enabled ? "Saved. Sign in with Google, then add the folders agents may read." : "Saved. Google Drive is off: no agent reads it.");
}

export async function signOutGoogleDriveAction(): Promise<ActionResult> {
  const signedOut = await powerloom.DELETE("/api/vaults/{vault}/google-drive/sign-in", { params: { path: { vault: await requireVault() } } });

  revalidatePath("/settings");

  return powerloomResult(signedOut, "Signed out: agents read no Drive file until someone signs in again.");
}

export async function addDriveFolderAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await powerloom.POST("/api/vaults/{vault}/google-drive/folders", { params: { path: { vault: await requireVault() } }, body: { folder: text(form, "folder") } });

  revalidatePath("/settings");

  return powerloomResult(added, "Added: agents may read it and everything below it.");
}

export async function removeDriveFolderAction(id: string): Promise<ActionResult> {
  const removed = await powerloom.DELETE("/api/vaults/{vault}/google-drive/folders/{id}", { params: { path: { vault: await requireVault(), id } } });

  revalidatePath("/settings");

  return powerloomResult(removed, "Removed.");
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

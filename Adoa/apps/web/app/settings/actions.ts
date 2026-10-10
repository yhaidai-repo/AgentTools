"use server";

import { addLocalRepo, removeLocalRepo, setRepoEnabled } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// The integration's switch and fields; an empty token keeps the saved one (user decision 2026-10-06). PowerLoom saves
// them and schedules the vault's jobs from the saved settings: nothing to apply here.
export async function saveAdoIntegration(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/ado/connection", {
    params: { path: { vault } },
    body: { enabled, orgUrl: field(form, "orgUrl"), project: field(form, "project"), team: field(form, "team"), user: field(form, "user"), pat: field(form, "pat") },
  });
  const result = powerloomResult(saved, enabled ? "Saved. The integration is on: PBI sync, mail sync and pull request sync run as configured below." : "Saved. The integration is off: nothing is read from Azure DevOps for this vault.");

  revalidatePath("/settings");

  return result;
}

export async function saveSettings(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/ado/pbi-sync-settings", {
    params: { path: { vault } },
    body: { enabled, cron: field(form, "cron"), maxItemsPerRun: Number(field(form, "maxItemsPerRun")), sprint: field(form, "sprint") || "current" },
  });
  const result = powerloomResult(saved, enabled ? "Saved. The next sync uses these settings." : "Saved. ADO PBI sync is off for this vault.");

  revalidatePath("/settings");

  return result;
}

export async function saveImportSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/import-sources", {
    params: { path: { vault } },
    body: { enabled, cron: field(form, "cron"), maxItemsPerRun: Number(field(form, "maxItemsPerRun")), importFolder: field(form, "importFolder") },
  });
  const result = powerloomResult(saved, enabled ? "Saved. The next import uses these settings." : "Saved. Mail sync is off for this vault.");

  revalidatePath("/settings");

  return result;
}

export async function savePullRequestSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const enabled = isEnabled(form);
  const repos = form.getAll("repos").map(String).filter(Boolean);
  const saved = await powerloom.PUT("/api/vaults/{vault}/ado/pull-request-settings", {
    params: { path: { vault } },
    body: { enabled, cron: field(form, "cron"), maxPullRequestsPerRun: Number(field(form, "maxPullRequestsPerRun")), repos },
  });
  const result = powerloomResult(saved, enabled ? `Saved: ${repos.length === 0 ? "every repo" : `${repos.length} repo(s)`}. The next pull request check uses these settings.` : "Saved. Pull request sync is off for this vault.");

  revalidatePath("/settings");

  return result;
}

// Tests what the form holds (the saved token when the field is empty), without saving.
export async function testConnection(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const checked = await powerloom.POST("/api/vaults/{vault}/ado/connection/test", {
    params: { path: { vault: await requireVault() } },
    body: { orgUrl: field(form, "orgUrl"), project: field(form, "project"), team: field(form, "team"), pat: field(form, "pat") },
  });

  if (!checked.response.ok || !checked.data) {
    return powerloomResult(checked, "");
  }

  return { ok: checked.data.ok, message: checked.data.message };
}

// Repository configuration (user decision 2026-10-06).
export async function setRepoEnabledAction(id: string, enabled: boolean): Promise<void> {
  await setRepoEnabled(getDb(), await requireVault(), id, enabled);
  revalidatePath("/settings");
}

export async function addLocalRepoAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await addLocalRepo(getDb(), await requireVault(), field(form, "name"), process.env.REPOS_MOUNT?.trim() || null);

  revalidatePath("/settings");

  return added.ok ? { ok: true, message: `${added.value.name} added and enabled.` } : { ok: false, message: added.error };
}

export async function removeLocalRepoAction(id: string): Promise<void> {
  await removeLocalRepo(getDb(), await requireVault(), id);
  revalidatePath("/settings");
}

// Every feature section's switch (user decision 2026-10-06).
function isEnabled(form: FormData): boolean {
  return form.get("enabled") === "on";
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

"use server";

import { checkConnection } from "@adoa/ado";
import { addLocalRepo, applyVaultJobSchedules, readAdoSettings, removeLocalRepo, saveAdoSettings, saveImportSettings, savePullRequestSettings, saveSyncSettings, saveVaultImportFolder, setRepoEnabled, setVaultFeature, type AdoSettings, type ImportSettings, type PullRequestSettings, type SyncSettings } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import type { ActionResult } from "@/models/ActionResult";

// The integration's switch and fields; an empty token keeps the saved one (user decision 2026-10-06).
export async function saveAdoIntegration(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const ado = await readAdoForm(form, vault);

  if (!ado.pat) {
    return { ok: false, message: "A personal access token is required." };
  }

  await saveAdoSettings(getDb(), vault, ado);

  const problem = await applySchedules();

  if (problem) {
    return { ok: false, message: problem };
  }

  revalidatePath("/settings");

  return { ok: true, message: ado.enabled ? "Saved. The integration is on: PBI sync, mail sync and pull request sync run as configured below." : "Saved. The integration is off: nothing is read from Azure DevOps for this vault." };
}

export async function saveSettings(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const sync = readSyncForm(form);

  if (!Number.isInteger(sync.maxItemsPerRun) || sync.maxItemsPerRun < 1) {
    return { ok: false, message: "Max PBIs per sync must be a whole number above 0." };
  }

  const vault = await requireVault();

  await saveSyncSettings(getDb(), vault, sync);
  await setVaultFeature(getDb(), vault, "adoSync", isEnabled(form));

  const problem = await applySchedules();

  if (problem) {
    return { ok: false, message: problem };
  }

  revalidatePath("/settings");

  return { ok: true, message: isEnabled(form) ? "Saved. The next sync uses these settings." : "Saved. ADO PBI sync is off for this vault." };
}

export async function saveImportSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const settings: ImportSettings = { cron: field(form, "cron"), maxItemsPerRun: Number(field(form, "maxItemsPerRun")) };

  if (!Number.isInteger(settings.maxItemsPerRun) || settings.maxItemsPerRun < 1) {
    return { ok: false, message: "Max items per run must be a whole number above 0." };
  }

  const importFolder = field(form, "importFolder").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");

  if (importFolder.includes("/") || importFolder.startsWith(".")) {
    return { ok: false, message: "The import folder is one folder name inside the import inbox." };
  }

  const vault = await requireVault();

  await saveImportSettings(getDb(), vault, settings);
  await saveVaultImportFolder(getDb(), vault, importFolder || null);
  await setVaultFeature(getDb(), vault, "mailSync", isEnabled(form));

  const problem = await applySchedules();

  if (problem) {
    return { ok: false, message: problem };
  }

  revalidatePath("/settings");

  return { ok: true, message: isEnabled(form) ? "Saved. The next import uses these settings." : "Saved. Mail sync is off for this vault." };
}

export async function savePullRequestSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const repos = form.getAll("repos").map(String).filter(Boolean);
  const settings: PullRequestSettings = { cron: field(form, "cron"), maxPullRequestsPerRun: Number(field(form, "maxPullRequestsPerRun")), repos };

  if (!Number.isInteger(settings.maxPullRequestsPerRun) || settings.maxPullRequestsPerRun < 1) {
    return { ok: false, message: "Max PRs per check must be a whole number above 0." };
  }

  const vault = await requireVault();

  await savePullRequestSettings(getDb(), vault, settings);
  await setVaultFeature(getDb(), vault, "pullRequests", isEnabled(form));

  const problem = await applySchedules();

  if (problem) {
    return { ok: false, message: problem };
  }

  revalidatePath("/settings");

  return { ok: true, message: isEnabled(form) ? `Saved: ${repos.length === 0 ? "every repo" : `${repos.length} repo(s)`}. The next pull request check uses these settings.` : "Saved. Pull request sync is off for this vault." };
}

// Tests what the form holds (the saved token when the field is empty), without saving.
export async function testConnection(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ado = await readAdoForm(form, await requireVault());

  if (!ado.pat) {
    return { ok: false, message: "Enter the personal access token first." };
  }

  return checkConnection({ orgUrl: ado.orgUrl, project: ado.project, team: ado.team, pat: ado.pat });
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

// The saved settings are kept even when pg-boss refuses a cron: the message says so, and the next save can fix it.
async function applySchedules(): Promise<string | null> {
  try {
    await applyVaultJobSchedules(await getBoss(), getDb());

    return null;
  } catch (error) {
    return `Saved, but not scheduled: ${errorMessage(error)}`;
  }
}

async function readAdoForm(form: FormData, vault: string): Promise<AdoSettings> {
  const saved = await readAdoSettings(getDb(), vault);

  return {
    enabled: isEnabled(form),
    orgUrl: field(form, "orgUrl"),
    project: field(form, "project"),
    team: field(form, "team"),
    user: field(form, "user"),
    pat: field(form, "pat") || saved?.pat || "",
  };
}

function readSyncForm(form: FormData): SyncSettings {
  return {
    cron: field(form, "cron"),
    maxItemsPerRun: Number(field(form, "maxItemsPerRun")),
    sprint: field(form, "sprint") || "current",
    states: field(form, "states").split(",").map((state) => state.trim()).filter(Boolean),
  };
}

// Every feature section's switch (user decision 2026-10-06).
function isEnabled(form: FormData): boolean {
  return form.get("enabled") === "on";
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

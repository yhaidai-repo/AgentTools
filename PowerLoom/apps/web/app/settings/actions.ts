"use server";

import { revalidatePath } from "next/cache";
import { requireVault } from "@/lib/currentVault";
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

// Repository configuration (user decision 2026-10-06), kept by PowerLoom.
export async function setRepoEnabledAction(id: string, enabled: boolean): Promise<void> {
  await powerloom.PUT("/api/vaults/{vault}/repos/{id}/enabled", { params: { path: { vault: await requireVault(), id } }, body: { enabled } });
  revalidatePath("/settings");
}

export async function addLocalRepoAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await powerloom.POST("/api/vaults/{vault}/repos/local", { params: { path: { vault: await requireVault() } }, body: { name: field(form, "name") } });

  revalidatePath("/settings");

  return added.data ? { ok: true, message: `${added.data.name} added and enabled.` } : powerloomResult(added, "");
}

export async function removeLocalRepoAction(id: string): Promise<void> {
  await powerloom.DELETE("/api/vaults/{vault}/repos/{id}", { params: { path: { vault: await requireVault(), id } } });
  revalidatePath("/settings");
}

// Read SQL (user decision 2026-10-12), kept by PowerLoom; which agents read is each agent's own switch.
export async function saveReadSqlAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/read-sql", { params: { path: { vault: await requireVault() } }, body: { enabled } });
  const result = powerloomResult(saved, enabled ? "Saved. Agents with Read SQL switched on may query the enabled connections." : "Saved. Read SQL is off: no agent queries this vault's databases.");

  revalidatePath("/settings");

  return result;
}

export async function addSqlConnectionAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await powerloom.POST("/api/vaults/{vault}/read-sql/connections", {
    params: { path: { vault: await requireVault() } },
    body: { name: field(form, "name"), connectionString: field(form, "connectionString") },
  });

  revalidatePath("/settings");

  return added.data ? { ok: true, message: `${added.data.name} added and enabled.` } : powerloomResult(added, "");
}

// Tests the typed string without saving it; the agent-runner signs in with the agents' SQL driver.
export async function testSqlConnectionAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return testSqlConnection({ name: field(form, "name") || null, connectionString: field(form, "connectionString") });
}

export async function testSavedSqlConnectionAction(name: string): Promise<ActionResult> {
  return testSqlConnection({ name, connectionString: null });
}

export async function setSqlConnectionEnabledAction(name: string, enabled: boolean): Promise<void> {
  await powerloom.PUT("/api/vaults/{vault}/read-sql/connections/{name}/enabled", { params: { path: { vault: await requireVault(), name } }, body: { enabled } });
  revalidatePath("/settings");
}

export async function removeSqlConnectionAction(name: string): Promise<void> {
  await powerloom.DELETE("/api/vaults/{vault}/read-sql/connections/{name}", { params: { path: { vault: await requireVault(), name } } });
  revalidatePath("/settings");
}

async function testSqlConnection(body: { name: string | null; connectionString: string | null }): Promise<ActionResult> {
  const checked = await powerloom.POST("/api/vaults/{vault}/read-sql/test", { params: { path: { vault: await requireVault() } }, body });

  return checked.data ? { ok: checked.data.ok, message: checked.data.message } : powerloomResult(checked, "");
}

// Read Azure (user decision 2026-10-12), kept by PowerLoom; which agents read which kind is each agent's own switches.
export async function saveReadAzureAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/read-azure", { params: { path: { vault: await requireVault() } }, body: { enabled } });
  const result = powerloomResult(saved, enabled ? "Saved. Agents with a kind's switch on may read the enabled resources of that kind." : "Saved. Read Azure is off: no agent reads this vault's Azure resources.");

  revalidatePath("/settings");

  return result;
}

// An empty secret keeps the saved one.
export async function saveAzureIdentityAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const saved = await powerloom.PUT("/api/vaults/{vault}/read-azure/identity", {
    params: { path: { vault: await requireVault() } },
    body: { tenantId: field(form, "tenantId"), clientId: field(form, "clientId"), clientSecret: field(form, "clientSecret") },
  });
  const result = powerloomResult(saved, "Saved. Test the sign-in, then assign the read-only roles to this application in Azure.");

  revalidatePath("/settings");

  return result;
}

// Signs in with the form's values (the saved secret when the field is empty) through the agent-runner, without saving.
export async function testAzureIdentityAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const checked = await powerloom.POST("/api/vaults/{vault}/read-azure/identity/test", {
    params: { path: { vault: await requireVault() } },
    body: { tenantId: field(form, "tenantId"), clientId: field(form, "clientId"), clientSecret: field(form, "clientSecret") },
  });

  return checked.data ? { ok: checked.data.ok, message: checked.data.message } : powerloomResult(checked, "");
}

export async function addAzureResourceAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await powerloom.POST("/api/vaults/{vault}/read-azure/resources", {
    params: { path: { vault: await requireVault() } },
    body: { name: field(form, "name"), kind: field(form, "kind"), target: field(form, "target") },
  });

  revalidatePath("/settings");

  return added.data ? { ok: true, message: `${added.data.name} added and enabled.` } : powerloomResult(added, "");
}

export async function setAzureResourceEnabledAction(name: string, enabled: boolean): Promise<void> {
  await powerloom.PUT("/api/vaults/{vault}/read-azure/resources/{name}/enabled", { params: { path: { vault: await requireVault(), name } }, body: { enabled } });
  revalidatePath("/settings");
}

export async function removeAzureResourceAction(name: string): Promise<void> {
  await powerloom.DELETE("/api/vaults/{vault}/read-azure/resources/{name}", { params: { path: { vault: await requireVault(), name } } });
  revalidatePath("/settings");
}

// Every feature section's switch (user decision 2026-10-06).
function isEnabled(form: FormData): boolean {
  return form.get("enabled") === "on";
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

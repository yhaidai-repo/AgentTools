"use server";

import { revalidatePath } from "next/cache";
import { requireVault } from "@/lib/currentVault";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";
import type { AzureLoginStart } from "@/models/AzureLoginStart";
import type { AzureLoginStatus } from "@/models/AzureLoginStatus";

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

// Local stack (user decision 2026-10-13), kept by PowerLoom: the vault's switch, the bridge's URL and token; an empty
// token keeps the saved one. Each agent's own switch is on its Config page.
export async function saveLocalStackAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/local-stack", {
    params: { path: { vault: await requireVault() } },
    body: { enabled, url: field(form, "url") || null, token: field(form, "token") || null },
  });
  const result = powerloomResult(saved, enabled ? "Saved. Agents with Local stack switched on may start this vault's services on this PC." : "Saved. Local stack is off: no agent starts services for this vault.");

  revalidatePath("/settings");

  return result;
}

// Calls the bridge from the agent-runner with the typed URL and token (the saved ones for empty fields); saves nothing.
export async function testLocalStackAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const checked = await powerloom.POST("/api/vaults/{vault}/local-stack/test", {
    params: { path: { vault: await requireVault() } },
    body: { url: field(form, "url") || null, token: field(form, "token") || null },
  });

  return checked.data ? { ok: checked.data.ok, message: checked.data.message } : powerloomResult(checked, "");
}

// Read Azure (user decisions 2026-10-12/13), kept by PowerLoom: one switch per kind here, and each agent's own
// switches per kind on its Config page.
export async function saveReadAzureKindAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const kind = field(form, "kind");
  const saved = await powerloom.PUT("/api/vaults/{vault}/read-azure/{kind}/enabled", { params: { path: { vault: await requireVault(), kind } }, body: { enabled } });
  const result = powerloomResult(saved, enabled ? "Saved. Agents with this kind's switch on may read its enabled resources." : "Saved. Off: no agent reads this kind for this vault.");

  revalidatePath("/settings");

  return result;
}

export async function addAzureResourceAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await powerloom.POST("/api/vaults/{vault}/read-azure/resources", {
    params: { path: { vault: await requireVault() } },
    body: { name: field(form, "name"), kind: field(form, "kind"), target: field(form, "target"), secret: field(form, "secret") },
  });

  revalidatePath("/settings");

  return added.data ? { ok: true, message: `${added.data.name} added and enabled.` } : powerloomResult(added, "");
}

// The user's own sign-in for App Insights (user decision 2026-10-13): the runner gets Entra's code; the page polls.
export async function startAzureLoginAction(): Promise<{ ok: true; start: AzureLoginStart } | { ok: false; message: string }> {
  const started = await powerloom.POST("/api/vaults/{vault}/read-azure/user-login/start", { params: { path: { vault: await requireVault() } } });

  if (!started.data) {
    return { ok: false, message: powerloomResult(started, "").message };
  }

  return { ok: true, start: { flowId: started.data.flowId, userCode: started.data.userCode, verificationUri: started.data.verificationUri, expiresInSeconds: started.data.expiresInSeconds } };
}

export async function azureLoginStatusAction(flowId: string): Promise<AzureLoginStatus> {
  const status = await powerloom.GET("/api/vaults/{vault}/read-azure/user-login/{flowId}", { params: { path: { vault: await requireVault(), flowId } } });

  if (!status.data) {
    return { status: "failed", error: powerloomResult(status, "").message };
  }

  if (status.data.status === "done") {
    revalidatePath("/settings");
  }

  return { status: status.data.status as AzureLoginStatus["status"], error: status.data.error ?? null };
}

export async function signOutAzureAction(): Promise<void> {
  await powerloom.DELETE("/api/vaults/{vault}/read-azure/user-login", { params: { path: { vault: await requireVault() } } });
  revalidatePath("/settings");
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

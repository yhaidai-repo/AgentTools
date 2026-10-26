"use server";

import { addLocalRepoCommand, enableRepoCommand, removeRepoCommand, runCleanupCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import { requireVault } from "@/lib/currentVault";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";
import type { AzureLoginStart } from "@/models/AzureLoginStart";
import type { AzureLoginStatus } from "@/models/AzureLoginStatus";
import type { CodexLoginStart, CodexLoginStatus } from "@/lib/aiProviders";
import { messageResult } from "@/lib/messageResult";

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

export async function saveCleanupSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const dryRun = form.get("dryRun") === "on";
  const saved = await powerloom.PUT("/api/vaults/{vault}/cleanup", {
    params: { path: { vault } },
    body: {
      dryRun,
      closedPbiDays: Number(field(form, "closedPbiDays")),
      trashDays: Number(field(form, "trashDays")),
      failedImportDays: Number(field(form, "failedImportDays")),
      runEventDays: Number(field(form, "runEventDays")),
      browserArtefactDays: Number(field(form, "browserArtefactDays")),
      failedRunBrowserArtefactDays: Number(field(form, "failedRunBrowserArtefactDays")),
    },
  });
  const result = powerloomResult(saved, dryRun ? "Saved. The next cleanup only reports what would go." : "Saved. The next cleanup deletes what is past its buffer.");

  revalidatePath("/settings");

  return result;
}

// Starts the vault's cleanup now (with the saved settings); the report lands on the dashboard's Application tab.
export async function runCleanupAction(_previous: ActionResult | null, _form: FormData): Promise<ActionResult> {
  const started = await runWebCommand(runCleanupCommand, { vault: await requireVault() });

  return messageResult(started);
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
  await runWebCommand(enableRepoCommand, { vault: await requireVault(), id, enabled });
  revalidatePath("/settings");
}

export async function addLocalRepoAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const added = await runWebCommand(addLocalRepoCommand, { vault: await requireVault(), name: field(form, "name") });

  revalidatePath("/settings");

  return added.ok ? { ok: true, message: `${added.value.name} added and enabled.` } : { ok: false, message: added.error };
}

export async function removeLocalRepoAction(id: string): Promise<void> {
  await runWebCommand(removeRepoCommand, { vault: await requireVault(), id });
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

// DevHub (user decision 2026-10-13), kept by PowerLoom: the vault's switch, DevHub's URL and token; an empty
// token keeps the saved one. Each agent's own switch is on its Config page.
export async function saveDevHubAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/devhub", {
    params: { path: { vault: await requireVault() } },
    body: { enabled, url: field(form, "url") || null, token: field(form, "token") || null },
  });
  const result = powerloomResult(saved, enabled ? "Saved. Agents with DevHub switched on may start this vault's services on this PC." : "Saved. DevHub is off: no agent starts services for this vault.");

  revalidatePath("/settings");

  return result;
}

// Calls DevHub from the agent-runner with the typed URL and token (the saved ones for empty fields); saves nothing.
export async function testDevHubAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const checked = await powerloom.POST("/api/vaults/{vault}/devhub/test", {
    params: { path: { vault: await requireVault() } },
    body: { url: field(form, "url") || null, token: field(form, "token") || null },
  });

  return checked.data ? { ok: checked.data.ok, message: checked.data.message } : powerloomResult(checked, "");
}

// GitHub (user decision 2026-10-25), kept by PowerLoom: the vault's switch, token and owner; an empty token keeps the
// saved one. Saving asks GitHub who the token is and lists the owner's repos.
export async function saveGitHubAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/github", {
    params: { path: { vault: await requireVault() } },
    body: { enabled, token: field(form, "token") || null, owner: field(form, "owner") || null },
  });
  const result = powerloomResult(saved, enabled ? "Saved. The owner's repos are being listed below; switch on the ones agents should read." : "Saved. GitHub is off: no repos are listed or cloned with it.");

  revalidatePath("/settings");

  return result;
}

// Asks GitHub with the typed token and owner (the saved ones for empty fields); saves nothing.
export async function testGitHubAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const checked = await powerloom.POST("/api/vaults/{vault}/github/test", {
    params: { path: { vault: await requireVault() } },
    body: { token: field(form, "token") || null, owner: field(form, "owner") || null },
  });

  return checked.data ? { ok: checked.data.ok, message: checked.data.message } : powerloomResult(checked, "");
}

// Settings → Sync → GitHub pull requests: the check's switch and schedule.
export async function saveGitHubPullRequestsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enabled = isEnabled(form);
  const saved = await powerloom.PUT("/api/vaults/{vault}/github/pull-requests", { params: { path: { vault: await requireVault() } }, body: { enabled, cron: field(form, "cron") } });

  revalidatePath("/settings");

  return powerloomResult(saved, enabled ? "Saved. The next GitHub pull request check uses this schedule." : "Saved. GitHub pull request sync is off for this vault.");
}

export async function checkGitHubPullRequestsAction(): Promise<ActionResult> {
  const queued = await powerloom.POST("/api/vaults/{vault}/github/pull-requests/sync", { params: { path: { vault: await requireVault() } } });

  revalidatePath("/settings");

  return powerloomResult(queued, "Checking GitHub; new PRs appear on Reviews in a few seconds.");
}

export async function syncGitHubAction(): Promise<ActionResult> {
  const queued = await powerloom.POST("/api/vaults/{vault}/github/sync", { params: { path: { vault: await requireVault() } } });

  revalidatePath("/settings");

  return powerloomResult(queued, "Listing the repos: reload in a moment.");
}

// Read Azure (user decisions 2026-10-12/14), kept by PowerLoom: one switch per kind here, and each agent's own
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

export async function saveAzureSubscriptionAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const subscription = field(form, "subscription");
  const saved = await powerloom.PUT("/api/vaults/{vault}/read-azure/subscription", { params: { path: { vault: await requireVault() } }, body: { subscription } });
  const result = powerloomResult(saved, subscription ? `Saved. Tools use ${subscription} unless an agent names a subscription.` : "Saved. No default: agents name a subscription per call.");

  revalidatePath("/settings");

  return result;
}

// The user's own sign-in (user decision 2026-10-13): the runner gets Entra's code; the page polls.
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

// Settings → AI providers (one for the whole PowerLoom): the Claude token, written and never read back.
export async function saveClaudeTokenAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const saved = await powerloom.PUT("/api/ai-providers/claude/token", { body: { token: field(form, "token") || null } });
  const result = powerloomResult(saved, "Saved. Agents on Claude models use this token from their next run.");

  revalidatePath("/settings");

  return result;
}

export async function removeClaudeTokenAction(): Promise<ActionResult> {
  const removed = await powerloom.DELETE("/api/ai-providers/claude/token");
  const result = powerloomResult(removed, removed.data?.connected ? "Removed. Runs use CLAUDE_CODE_OAUTH_TOKEN from .env again." : "Removed. Claude isn't connected: its agents stop until a token is saved.");

  revalidatePath("/settings");

  return result;
}

// The app chats open in: "Continue with …" and "Configure with …" follow it.
export async function saveChatAppAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const saved = await powerloom.PUT("/api/chats/app", { body: { launcher: field(form, "launcher") } });
  const label = saved.data?.apps.find((app) => app.id === saved.data?.current)?.label ?? "the chosen app";
  const result = powerloomResult(saved, `Saved. Chats open in ${label}.`);

  revalidatePath("/", "layout");

  return result;
}

// Connect Codex (Settings → AI providers): the agent-runner signs in to PowerLoom's own Codex home with a device code.
export async function startCodexLoginAction(): Promise<{ ok: true; start: CodexLoginStart } | { ok: false; message: string }> {
  const started = await powerloom.POST("/api/ai-providers/codex/login");

  return started.data ? { ok: true, start: started.data } : { ok: false, message: powerloomResult(started, "").message };
}

export async function codexLoginStatusAction(): Promise<CodexLoginStatus> {
  const status = await powerloom.GET("/api/ai-providers/codex/login");

  if (!status.data) {
    return { status: "failed", error: powerloomResult(status, "").message, output: "" };
  }

  if (status.data.status === "done") {
    revalidatePath("/settings");
  }

  return status.data;
}

export async function cancelCodexLoginAction(): Promise<ActionResult> {
  return powerloomResult(await powerloom.POST("/api/ai-providers/codex/login/cancel"), "Cancelled. Connect Codex starts a new sign-in.");
}

export async function disconnectCodexAction(): Promise<ActionResult> {
  const disconnected = await powerloom.DELETE("/api/ai-providers/codex/login");
  const result = powerloomResult(disconnected, "Disconnected. Agents on Codex models stop until Codex is connected again.");

  revalidatePath("/settings");

  return result;
}

// The fallback when the device sign-in fails: the auth.json of a PC where `codex login` worked.
export async function saveCodexLoginFileAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const file = form.get("authJson");
  const authJson = file instanceof File ? await file.text() : "";
  const saved = await powerloom.PUT("/api/ai-providers/codex/login-file", { body: { authJson: authJson || null } });
  const result = powerloomResult(saved, "Saved. Codex is connected with the uploaded login.");

  revalidatePath("/settings");

  return result;
}

// Every feature section's switch (user decision 2026-10-06).
function isEnabled(form: FormData): boolean {
  return form.get("enabled") === "on";
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

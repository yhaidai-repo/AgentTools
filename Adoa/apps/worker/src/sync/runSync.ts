import { AdoClient } from "@adoa/ado";
import { finishRun, isAdoConfigured, readAdoSettings, readSyncSettings, startRun, type AdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";
import { VaultWriter } from "@adoa/vault";
import { requireEnv, vaultRoot } from "../env";
import { loadScope } from "./loadScope";
import type { SyncContext } from "./models/SyncContext";
import type { SyncResult } from "./models/SyncResult";
import { renderIndexNote, renderSprintNotes } from "./renderOverviewNotes";
import { snapshotCurrentSprint } from "./snapshotSprint";
import { syncRepositories } from "./syncRepositories";
import { syncWorkItems } from "./syncWorkItems";

export async function runSync(db: AdoaDb): Promise<void> {
  const runId = await startRun(db, "sync");

  try {
    const result = await syncOnce(db, runId);

    await finishRun(db, runId, result.outcome, result.outcome === "success" ? null : result.message);
    console.log(`sync ${result.outcome}: ${result.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await finishRun(db, runId, "failed", message);
    throw error;
  }
}

async function syncOnce(db: AdoaDb, runId: number): Promise<SyncResult> {
  const ado = await readAdoSettings(db);

  if (!isAdoConfigured(ado)) {
    return { outcome: "no-op", message: "ADO settings are not configured" };
  }

  const ctx = createContext(db, ado, runId);
  const sync = await readSyncSettings(db);
  const scope = await loadScope(ctx.client, ado, sync);

  if (!scope) {
    return { outcome: "no-op", message: `Sprint "${sync.sprint}" not found in the team's iterations` };
  }

  const notesWritten = await syncWorkItems(ctx, scope);

  await snapshotCurrentSprint(db, scope.sprints);
  await renderSprintNotes(ctx, scope.sprints);
  await renderIndexNote(ctx, scope.sprints);

  const repositories = await syncRepositories(ctx);

  return {
    outcome: "success",
    message: `${scope.sprints[0].name}: ${scope.allIds.length} PBIs in scope, ${notesWritten} notes written, ${repositories} repos`,
  };
}

function createContext(db: AdoaDb, ado: AdoSettings, runId: number): SyncContext {
  const client = new AdoClient({ orgUrl: ado.orgUrl, project: ado.project, team: ado.team, pat: requireEnv("ADO_PAT") });

  return { db, client, ado, writer: new VaultWriter(vaultRoot()), runId };
}

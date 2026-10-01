import type { AdoaDb } from "@adoa/db";
import { renderPipelineNotes } from "./renderPipelineNotes";
import { writeDrafts } from "./writeDrafts";

// The one safe way to update the Vault for a PBI: nothing but its DB state is written. Its agents' drafts first
// (a rejected one becomes a human task, which the notes then show), then its notes. Used by the agent-runner after a task
// and by the worker after the user's changes.
export async function publishPbi(db: AdoaDb, vaultRoot: string, adoId: number): Promise<void> {
  await writeDrafts(db, adoId);
  await renderPipelineNotes(db, vaultRoot, adoId);
}

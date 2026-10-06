import { vaultCapture, workItem, type AdoaDb } from "@adoa/db";
import { eq, inArray } from "drizzle-orm";
import { VaultCaptureCli } from "./VaultCaptureCli";

type CaptureRow = typeof vaultCapture.$inferSelect;

const WRITTEN = ["created", "appended"];

// A written draft blocks the other agents until it is merged: verified, moved to its target and deleted from draft/
// (user decision 2026-10-01). The module's is-draft tells which are gone; those become `merged`.
// All PBIs' drafts, checked by the worker's drafts job.
export async function markMergedDrafts(db: AdoaDb): Promise<number> {
  const written = await db
    .select({ capture: vaultCapture, vault: workItem.vault })
    .from(vaultCapture)
    .innerJoin(workItem, eq(workItem.adoId, vaultCapture.pbiId))
    .where(inArray(vaultCapture.status, WRITTEN));
  const vaults = [...new Set(written.map((row) => row.vault))];
  let merged = 0;

  for (const vault of vaults) {
    merged += await markMergedInVault(db, vault, written.filter((row) => row.vault === vault).map((row) => row.capture));
  }

  return merged;
}

async function markMergedInVault(db: AdoaDb, vault: string, written: CaptureRow[]): Promise<number> {
  const cli = await VaultCaptureCli.forVault(vault, `${written.length} vault draft(s) to check`);
  const stillDrafts = await cli.isDraft([...new Set(written.map((capture) => capture.name))]);
  const merged = written.filter((capture) => stillDrafts[capture.name] === false).map((capture) => capture.id);

  if (merged.length > 0) {
    await db.update(vaultCapture).set({ status: "merged" }).where(inArray(vaultCapture.id, merged));
  }

  return merged.length;
}

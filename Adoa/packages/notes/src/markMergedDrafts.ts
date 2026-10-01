import { vaultCapture, type AdoaDb } from "@adoa/db";
import { inArray } from "drizzle-orm";
import { VaultCaptureCli } from "./VaultCaptureCli";

const WRITTEN = ["created", "appended"];

// A written draft blocks the other agents until it is merged: verified, moved to its target and deleted from draft/
// (user decision 2026-10-01). The module's is-draft tells which are gone; those become `merged`.
// All PBIs' drafts, checked by the worker's drafts job.
export async function markMergedDrafts(db: AdoaDb): Promise<number> {
  const written = await db.select().from(vaultCapture).where(inArray(vaultCapture.status, WRITTEN));

  if (written.length === 0) {
    return 0;
  }

  const cli = await VaultCaptureCli.fromEnv(`${written.length} vault draft(s) to check`);
  const stillDrafts = await cli.isDraft([...new Set(written.map((capture) => capture.name))]);
  const merged = written.filter((capture) => stillDrafts[capture.name] === false).map((capture) => capture.id);

  if (merged.length > 0) {
    await db.update(vaultCapture).set({ status: "merged" }).where(inArray(vaultCapture.id, merged));
  }

  return merged.length;
}

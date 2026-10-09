import { agentRun, attachment, bug, deletedPbi, design, localItem, pbiFeedback, pbiRepo, refinement, statusHistory, vaultCapture, workItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { childIds } from "./bugs/childItems";
import type { Outcome } from "./models/Outcome";

// Its id (123, #123), a link to it in Azure DevOps (…/_workitems/edit/123, …/workitems/123, ?id=123) or in adoa (/pbis/123).
const PBI_REFERENCES = [/^#?(\d+)$/, /workitems\/(?:edit\/)?(\d+)/i, /\/pbis\/(\d+)/, /[?&]id=(\d+)/];

// A PBI as the user types it.
export function parsePbiReference(text: string): number | null {
  const value = text.trim();
  const id = PBI_REFERENCES.map((pattern) => value.match(pattern)?.[1]).find(Boolean);

  return id ? Number(id) : null;
}

// Why the PBI can't be deleted now: an agent run on it, or on a child item deleted with it, would write into rows that
// are gone.
export async function pbiDeleteProblem(db: AdoaDb, adoId: number): Promise<string | null> {
  for (const id of [adoId, ...(await childIds(db, adoId))]) {
    const runId = await runningRunOn(db, id);

    if (runId !== null) {
      return `RUN-${runId} is working on PBI-${id}; delete it when the run has ended.`;
    }
  }

  return null;
}

// The agent run working on the PBI now, if any.
export async function runningRunOn(db: AdoaDb, adoId: number): Promise<number | null> {
  const [running] = await db.select({ id: agentRun.id }).from(agentRun).where(and(eq(agentRun.pbiId, adoId), eq(agentRun.outcome, "running"))).limit(1);

  return running?.id ?? null;
}

// Deletes the PBI in adoa only (ADO untouched, user decision 2026-10-02): its child items first (they belong to it, user
// decision 2026-10-09), then the PBI. Each is remembered so sync doesn't bring it back. The usage records stay.
export async function deletePbiData(db: AdoaDb, adoId: number): Promise<Outcome<string>> {
  const problem = await pbiDeleteProblem(db, adoId);
  const [pbi] = await db.select({ title: workItem.title }).from(workItem).where(eq(workItem.adoId, adoId));

  if (problem || !pbi) {
    return { ok: false, error: problem ?? `PBI-${adoId} isn't in adoa.` };
  }

  for (const childId of await childIds(db, adoId)) {
    await deleteWorkItem(db, childId);
  }

  await deleteWorkItem(db, adoId);

  return { ok: true, value: pbi.title };
}

// One work item with its bug record, tasks, questions, runs, attachments, repos, refinements and drafts.
async function deleteWorkItem(db: AdoaDb, adoId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [pbi] = await tx.select({ title: workItem.title }).from(workItem).where(eq(workItem.adoId, adoId));
    const itemIds = (await tx.select({ id: localItem.id }).from(localItem).where(eq(localItem.pbiId, adoId))).map((row) => row.id);
    const ofItems = itemIds.length > 0 ? inArray(agentRun.itemId, itemIds) : undefined;

    await tx.delete(statusHistory).where(or(and(eq(statusHistory.entityKind, "pbi"), eq(statusHistory.entityId, String(adoId))), itemIds.length > 0 ? inArray(statusHistory.entityId, itemIds) : undefined));
    await tx.delete(bug).where(eq(bug.workItemId, adoId));
    await tx.delete(attachment).where(eq(attachment.pbiId, adoId));
    await tx.delete(pbiRepo).where(eq(pbiRepo.pbiId, adoId));
    await tx.delete(vaultCapture).where(eq(vaultCapture.pbiId, adoId));
    await tx.delete(refinement).where(eq(refinement.pbiId, adoId));
    await tx.delete(design).where(eq(design.pbiId, adoId));
    await tx.delete(pbiFeedback).where(eq(pbiFeedback.pbiId, adoId)); // its WWW records stay: they are in the vault log
    // Items and status rows elsewhere may point at this PBI's runs (created_by_run, run_id): they let go first.
    const runIds = (await tx.select({ id: agentRun.id }).from(agentRun).where(or(eq(agentRun.pbiId, adoId), ofItems))).map((row) => row.id);

    if (runIds.length > 0) {
      await tx.update(localItem).set({ createdByRun: null }).where(inArray(localItem.createdByRun, runIds));
      await tx.update(statusHistory).set({ runId: null }).where(inArray(statusHistory.runId, runIds));
    }

    await tx.delete(agentRun).where(or(eq(agentRun.pbiId, adoId), ofItems));
    await tx.delete(localItem).where(eq(localItem.pbiId, adoId));
    await tx.delete(workItem).where(eq(workItem.adoId, adoId));
    await tx.insert(deletedPbi).values({ adoId, title: pbi.title }).onConflictDoUpdate({ target: deletedPbi.adoId, set: { title: pbi.title, deletedAt: new Date() } });
  });
}

export async function deletedPbiIds(db: AdoaDb): Promise<number[]> {
  return (await db.select({ adoId: deletedPbi.adoId }).from(deletedPbi)).map((row) => row.adoId);
}

// Syncing a deleted PBI by hand brings it back on purpose.
export async function forgetDeletedPbi(db: AdoaDb, adoId: number): Promise<void> {
  await db.delete(deletedPbi).where(eq(deletedPbi.adoId, adoId));
}

import { agentRun, attachment, design, localItem, refinement, vaultCapture, workItem } from "@powerloom/db";
import { ATTACHMENT_SUMMARY_COLUMNS, latestPbiEstimate, latestPlan, loadItemDetail as loadItemDetailOf, pbiRepoEntries, readBug, readChildItems } from "@powerloom/core";
import { and, desc, eq, ne } from "drizzle-orm";
import { loadRunTotals } from "./agentTotals";
import { getDb } from "./db";

// Everything the PBI page shows.
export async function loadPbiDetail(adoId: number) {
  const db = getDb();
  const [pbi] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi) {
    return null;
  }

  // Items the user deleted stay in the DB (so agents don't recreate them) but aren't shown.
  const items = await db.select().from(localItem).where(and(eq(localItem.pbiId, adoId), ne(localItem.status, "deleted"))).orderBy(localItem.id);
  const attachments = await db.select(ATTACHMENT_SUMMARY_COLUMNS).from(attachment).where(eq(attachment.pbiId, adoId)).orderBy(attachment.id);
  const runs = await db.select().from(agentRun).where(eq(agentRun.pbiId, adoId)).orderBy(desc(agentRun.id));
  const [latestRefinement] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);
  const [latestDesign] = await db.select().from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);
  const plan = await latestPlan(db, adoId);
  const estimate = await latestPbiEstimate(db, adoId);
  const drafts = await db.select().from(vaultCapture).where(eq(vaultCapture.pbiId, adoId)).orderBy(vaultCapture.id);
  const repos = await pbiRepoEntries(db, adoId);
  const relations = await loadRelations(adoId, pbi.parentId);
  const usage = await loadRunTotals(runs);

  return { pbi, items, attachments, runs, usage, drafts, repos, refinement: latestRefinement ?? null, plan, design: latestDesign ?? null, estimate, ...relations };
}

// Where the PBI sits (user decision 2026-10-09): its parent and bug record when it is a child, its child items.
async function loadRelations(adoId: number, parentId: number | null) {
  const db = getDb();
  const [parent] = parentId === null ? [] : await db.select({ adoId: workItem.adoId, title: workItem.title }).from(workItem).where(eq(workItem.adoId, parentId));

  return { parent: parent ?? null, bug: await readBug(db, adoId), children: await readChildItems(db, adoId) };
}

// One item with its uploads, its runs and its findings (core, shared with task.get) with the web's database.
export function loadItemDetail(itemId: string) {
  return loadItemDetailOf(getDb(), itemId);
}

export type PbiDetail = NonNullable<Awaited<ReturnType<typeof loadPbiDetail>>>;
export type ItemDetail = NonNullable<Awaited<ReturnType<typeof loadItemDetail>>>;
export type ItemRow = PbiDetail["items"][number];

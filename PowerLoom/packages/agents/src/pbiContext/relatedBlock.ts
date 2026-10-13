import { readChildItems, pbiRepoEntries } from "@powerloom/core";
import { design, localItem, refinement, vaultCapture, type PowerLoomDb, type workItem } from "@powerloom/db";
import { and, desc, eq, ne, notInArray } from "drizzle-orm";
import { LISTED_KINDS } from "../pbiInputs";
import type { PbiReference } from "../models/PbiReference";

type WorkItemRow = typeof workItem.$inferSelect;

const TITLE_CHARS = 160;

// What the other blocks don't list: the parent and child items, the latest refinement and design, the findings, results
// and other agent tasks, and the vault drafts; each by reference.
export async function loadRelated(db: PowerLoomDb, row: WorkItemRow): Promise<PbiReference[]> {
  return [
    ...parentReference(row),
    ...(await childReferences(db, row.adoId)),
    ...(await versionedReferences(db, row.adoId)),
    ...(await itemReferences(db, row.adoId)),
    ...(await draftReferences(db, row.adoId)),
  ];
}

export function relatedBlock(references: PbiReference[], repos: string[]): string {
  const lines = references.map((entry) => `- ${entry.ref} (${entry.kind}, ${entry.status}): ${entry.title}`);
  const body = lines.length > 0 ? lines : ["none"];

  return ["<pbi-related>", "Everything else this PBI has. Read any of it in full with read_pbi(ref).", ...body, ...repos, "</pbi-related>"].join("\n");
}

// The PBI's repos, as one line under the references (names only: the repo tools read the code).
export async function repoLine(db: PowerLoomDb, adoId: number): Promise<string[]> {
  const repos = await pbiRepoEntries(db, adoId);

  return repos.length > 0 ? [`Repos: ${repos.map((repo) => `${repo.name} (${repo.source})`).join(", ")}`] : [];
}

function parentReference(row: WorkItemRow): PbiReference[] {
  return row.parentId === null ? [] : [{ ref: `PBI-${row.parentId}`, kind: "parent PBI", status: "-", title: "the PBI this item belongs to" }];
}

async function childReferences(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const children = await readChildItems(db, adoId);

  return children.map((child) => ({ ref: `PBI-${child.adoId}`, kind: `child ${child.type}`, status: child.pipelineStatus, title: short(child.title) }));
}

async function versionedReferences(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const [latestRefinement] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);
  const [latestDesign] = await db.select().from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);
  const references: PbiReference[] = [];

  if (latestRefinement) {
    references.push({ ref: `PBI-${adoId}:refinement`, kind: "refinement", status: `v${latestRefinement.version}`, title: short(latestRefinement.summary) });
  }

  if (latestDesign) {
    references.push({ ref: `PBI-${adoId}:design`, kind: "design", status: `v${latestDesign.version}`, title: short(latestDesign.approach || "-") });
  }

  return references;
}

// Questions, human tasks and research tasks are in <existing-items> already; deleted items stay hidden.
async function itemReferences(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const rows = await db
    .select({ id: localItem.id, kind: localItem.kind, status: localItem.status, title: localItem.title })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), notInArray(localItem.kind, [...LISTED_KINDS]), ne(localItem.status, "deleted")))
    .orderBy(localItem.id);

  return rows.map((item) => ({ ref: item.id, kind: item.kind, status: item.status, title: short(item.title) }));
}

async function draftReferences(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const rows = await db.select({ id: vaultCapture.id, status: vaultCapture.status, title: vaultCapture.title }).from(vaultCapture).where(eq(vaultCapture.pbiId, adoId)).orderBy(vaultCapture.id);

  return rows.map((draft) => ({ ref: `DRAFT-${draft.id}`, kind: "vault draft", status: draft.status, title: short(draft.title) }));
}

function short(text: string): string {
  return text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS)}…` : text;
}

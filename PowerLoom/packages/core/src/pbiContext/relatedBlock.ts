import { readChildItems } from "../bugs/childItems";
import { estimateText, latestPbiEstimate } from "../pbiEstimates";
import { pbiRepoEntries } from "../pbiRepos";
import { latestBuild } from "../implementation/latestBuild";
import { latestPlan } from "../planning/latestPlan";
import { design, localItem, refinement, runResult, testCase, vaultCapture, type PowerLoomDb, type workItem } from "@powerloom/db";
import { and, desc, eq, ne, notInArray } from "drizzle-orm";
import { LISTED_KINDS } from "./pbiInputs";
import type { PbiReference } from "../models/PbiReference";

type WorkItemRow = typeof workItem.$inferSelect;

const TITLE_CHARS = 160;

// What the other blocks don't list: the parent and child items, the latest refinement, plan, build, design and estimate, every run's
// result, the findings, results and other agent tasks, the vault drafts and the Azure DevOps test cases read so far; each
// by reference (user decision 2026-10-22: the context lists everything the PBI has).
export async function loadRelated(db: PowerLoomDb, row: WorkItemRow): Promise<PbiReference[]> {
  return [
    ...parentReference(row),
    ...(await childReferences(db, row.adoId)),
    ...(await versionedReferences(db, row.adoId)),
    ...(await estimateReference(db, row.adoId)),
    ...(await resultReferences(db, row.adoId)),
    ...(await itemReferences(db, row.adoId)),
    ...(await draftReferences(db, row.adoId)),
    ...(await testCaseReferences(db, row.adoId)),
  ];
}

export function relatedBlock(references: PbiReference[], repos: string[]): string {
  const lines = references.map((entry) => `- ${entry.ref} (${entry.kind}, ${entry.status}): ${entry.title}`);
  const body = lines.length > 0 ? lines : ["none"];

  return ["<pbi-related>", "Everything else this PBI has. Read any of it in full by its ref (agents: read_pbi; Claude chats: the pbi.read command).", ...body, ...repos, "</pbi-related>"].join("\n");
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
  const plan = await latestPlan(db, adoId);
  const build = await latestBuild(db, adoId);
  const [latestDesign] = await db.select().from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);
  const references: PbiReference[] = [];

  if (latestRefinement) {
    references.push({ ref: `PBI-${adoId}:refinement`, kind: "refinement", status: `v${latestRefinement.version}`, title: short(latestRefinement.summary) });
  }

  if (plan) {
    references.push({ ref: `PBI-${adoId}:plan`, kind: "plan", status: `v${plan.version}`, title: short(plan.plan.summary || "-") });
  }

  if (build) {
    references.push({ ref: `PBI-${adoId}:build`, kind: "build", status: `v${build.version} ${build.build.handOver.state}`, title: short(build.build.summary || "-") });
  }

  if (latestDesign) {
    references.push({ ref: `PBI-${adoId}:design`, kind: "design", status: `v${latestDesign.version}`, title: short(latestDesign.approach || "-") });
  }

  return references;
}

// The latest estimate from any agent (user decision 2026-10-18); the reference reads it with its basis.
async function estimateReference(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const latest = await latestPbiEstimate(db, adoId);

  return latest ? [{ ref: `PBI-${adoId}:estimate`, kind: "estimate", status: "latest", title: estimateText(latest) }] : [];
}

// Questions, human tasks and research tasks are in <existing-items> already; deleted items stay hidden.
// Every run's result on the PBI, oldest first: the latest complete one of a task is its current result, the earlier ones
// its history. The ref stays valid once the run is deleted.
async function resultReferences(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const rows = await db
    .select({ id: runResult.id, runId: runResult.runId, taskId: runResult.taskId, agent: runResult.agent, status: runResult.status, body: runResult.body })
    .from(runResult).where(eq(runResult.pbiId, adoId)).orderBy(runResult.createdAt);

  return rows.map((row) => ({ ref: resultRef(row.id), kind: `result of ${row.taskId ?? "a deleted task"} by ${row.agent}`, status: row.status, title: short(resultTitle(row.runId, row.body)) }));
}

function resultTitle(runId: number | null, body: string): string {
  const firstLine = body.split(/\r?\n/).find((line) => line.trim())?.replace(/^#+\s*/, "") ?? "-";

  return runId === null ? firstLine : `RUN-${runId}: ${firstLine}`;
}

export function resultRef(id: number): string {
  return `RESULT-${id}`;
}

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

// Saved by read_test_cases; the list is as fresh as its last read.
async function testCaseReferences(db: PowerLoomDb, adoId: number): Promise<PbiReference[]> {
  const rows = await db.select({ adoId: testCase.adoId, state: testCase.state, title: testCase.title }).from(testCase).where(eq(testCase.pbiId, adoId)).orderBy(testCase.adoId);

  return rows.map((row) => ({ ref: `TC-${row.adoId}`, kind: "test case", status: row.state, title: short(row.title) }));
}

function short(text: string): string {
  return text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS)}…` : text;
}

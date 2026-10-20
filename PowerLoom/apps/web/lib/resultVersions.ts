import { agentRun, codeReviewVersion, design, localItem, pbiEstimate, refinement } from "@powerloom/db";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import type { AgentResult } from "@/models/AgentResult";
import type { ResultSet } from "@/models/ResultSet";
import type { ResultVersion } from "@/models/ResultVersion";
import { getDb } from "./db";
import { RESULT_KINDS } from "./items";
import { versionKey } from "./resultLinks";
import { reviewTaskPrId, reviewTasksOf } from "./reviews";

type ItemResultRow = Awaited<ReturnType<typeof itemRows>>[number];

const ITEM_TITLES: Record<string, string> = { "research-result": "Research results", "test-report": "Test reports" };

// A PBI's results on its page (user decision 2026-10-21: every version under its task, one shown): its estimates,
// refinements and designs, then each research or test task's results.
export async function loadPbiResultSets(adoId: number): Promise<ResultSet[]> {
  const [estimates, refinements, designs, items] = await Promise.all([
    estimateVersions(eq(pbiEstimate.pbiId, adoId)),
    refinementVersions(eq(refinement.pbiId, adoId)),
    designVersions(eq(design.pbiId, adoId)),
    itemRows(eq(localItem.pbiId, adoId)),
  ]);

  return [
    { key: "estimate", title: "Estimate", task: null, versions: estimates, empty: "No agent has estimated it yet." },
    { key: "refinement", title: "Refinement", task: null, versions: refinements, empty: "Not refined yet." },
    { key: "design", title: "Design", task: null, versions: designs, empty: "Not designed yet." },
    ...itemSets(items),
  ];
}

// A pull request's reviews (user decision 2026-10-21): one version per successful review run, each rerun being a new
// review task. A review task's page opens on its own newest version (`ownRunIds`), the review page on the latest.
export async function loadReviewResultSet(prId: number, ownRunIds: number[] = []): Promise<ResultSet> {
  const versions = await reviewVersions(prId);
  const own = versions.filter((version) => version.runId !== null && ownRunIds.includes(version.runId)).at(-1);

  return { key: "review", title: "Review", task: null, versions, empty: "Not reviewed yet.", preferred: own ? versionKey(own) : undefined };
}

// What one task's runs wrote: the refinement, design or estimate versions of its runs, the result items answering it,
// or, for a review task, its pull request's reviews (opening on its own run). Estimates keep the numbers they have on
// the PBI page, so they are counted over the whole PBI first.
export async function loadTaskResultSets(task: { id: string; pbiId: number | null; kind: string; data: unknown }, runIds: number[]): Promise<ResultSet[]> {
  const prId = task.kind === "review" ? reviewTaskPrId(task.data) : null;
  const [reviews, items, refinements, designs, estimates] = await Promise.all([
    prId === null ? null : loadReviewResultSet(prId, runIds),
    itemRows(eq(localItem.parentId, task.id)),
    runIds.length === 0 ? [] : refinementVersions(inArray(refinement.runId, runIds)),
    runIds.length === 0 ? [] : designVersions(inArray(design.runId, runIds)),
    runIds.length === 0 || task.pbiId === null ? [] : estimatesOfRuns(task.pbiId, runIds),
  ]);
  const sets: ResultSet[] = [
    ...(reviews ? [reviews] : []),
    { key: "refinement", title: "Refinement", task: null, versions: refinements, empty: "" },
    { key: "design", title: "Design", task: null, versions: designs, empty: "" },
    { key: "estimate", title: "Estimate", task: null, versions: estimates, empty: "" },
    ...itemSets(items),
  ];

  return sets.filter((set) => set.versions.length > 0);
}

// The versions beside one result on its full page: the PBI's for a refinement, design or estimate, the task's for an
// item, the pull request's for a review run.
export async function loadSiblingVersions(result: AgentResult, owner: { pbiId: number | null; taskId: string | null }): Promise<ResultVersion[]> {
  if (result.kind === "review") {
    return reviewVersions(result.row.prId);
  }

  if (result.kind === "item") {
    return owner.taskId === null ? [] : itemSets(await itemRows(eq(localItem.parentId, owner.taskId)))[0]?.versions ?? [];
  }

  const pbiId = owner.pbiId;

  if (pbiId === null) {
    return [];
  }

  const loaders = { refinement: () => refinementVersions(eq(refinement.pbiId, pbiId)), design: () => designVersions(eq(design.pbiId, pbiId)), estimate: () => estimateVersions(eq(pbiEstimate.pbiId, pbiId)) };

  return loaders[result.kind]();
}

// Every successful review run of the pull request, with when its version was kept (its start for runs from before).
async function reviewVersions(prId: number): Promise<ResultVersion[]> {
  const rows = await getDb()
    .select({ runId: agentRun.id, agent: agentRun.stage, startedAt: agentRun.startedAt, keptAt: codeReviewVersion.createdAt })
    .from(agentRun)
    .innerJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(codeReviewVersion, eq(codeReviewVersion.runId, agentRun.id))
    .where(and(reviewTasksOf(prId), eq(agentRun.outcome, "success")))
    .orderBy(asc(agentRun.id));

  return rows.map((row, index) => ({ kind: "review", id: String(row.runId), label: `v${index + 1}`, runId: row.runId, agent: row.agent, at: row.keptAt ?? row.startedAt, status: null }));
}

async function refinementVersions(where: SQL): Promise<ResultVersion[]> {
  const rows = await getDb()
    .select({ id: refinement.id, version: refinement.version, runId: refinement.runId, agent: agentRun.stage, at: refinement.createdAt })
    .from(refinement)
    .leftJoin(agentRun, eq(agentRun.id, refinement.runId))
    .where(where)
    .orderBy(asc(refinement.version));

  return rows.map((row) => ({ kind: "refinement", id: String(row.id), label: `v${row.version}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

async function designVersions(where: SQL): Promise<ResultVersion[]> {
  const rows = await getDb()
    .select({ id: design.id, version: design.version, runId: design.runId, agent: agentRun.stage, at: design.createdAt })
    .from(design)
    .leftJoin(agentRun, eq(agentRun.id, design.runId))
    .where(where)
    .orderBy(asc(design.version));

  return rows.map((row) => ({ kind: "design", id: String(row.id), label: `v${row.version}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

async function estimatesOfRuns(pbiId: number, runIds: number[]): Promise<ResultVersion[]> {
  const all = await estimateVersions(eq(pbiEstimate.pbiId, pbiId));

  return all.filter((version) => version.runId !== null && runIds.includes(version.runId));
}

// Estimates have no version number: they count in the order agents recorded them.
async function estimateVersions(where: SQL): Promise<ResultVersion[]> {
  const rows = await getDb()
    .select({ id: pbiEstimate.id, runId: pbiEstimate.runId, agent: pbiEstimate.agent, at: pbiEstimate.createdAt })
    .from(pbiEstimate)
    .where(where)
    .orderBy(asc(pbiEstimate.createdAt), asc(pbiEstimate.id));

  return rows.map((row, index) => ({ kind: "estimate", id: String(row.id), label: `v${index + 1}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

function itemRows(where: SQL) {
  return getDb()
    .select({ id: localItem.id, kind: localItem.kind, parentId: localItem.parentId, pbiId: localItem.pbiId, runId: localItem.createdByRun, agent: agentRun.stage, at: localItem.createdAt, status: localItem.status })
    .from(localItem)
    .leftJoin(agentRun, eq(agentRun.id, localItem.createdByRun))
    .where(and(where, inArray(localItem.kind, RESULT_KINDS)))
    .orderBy(asc(localItem.id));
}

// Result items grouped by the task they answer, each group in the order its items were written.
function itemSets(rows: ItemResultRow[]): ResultSet[] {
  return [...groupByTask(rows)].map(([taskId, own]) => ({
    key: taskId,
    title: ITEM_TITLES[own[0].kind] ?? "Results",
    task: { id: taskId, pbiId: own[0].pbiId },
    versions: own.map((row, index) => ({ kind: "item", id: row.id, label: `v${index + 1}`, runId: row.runId, agent: row.agent, at: row.at, status: row.status })),
    empty: "",
  }));
}

function groupByTask(rows: ItemResultRow[]): Map<string, ItemResultRow[]> {
  const byTask = new Map<string, ItemResultRow[]>();

  for (const row of rows.filter((candidate) => candidate.parentId !== null)) {
    byTask.set(row.parentId!, [...(byTask.get(row.parentId!) ?? []), row]);
  }

  return byTask;
}

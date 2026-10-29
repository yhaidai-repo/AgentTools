import { agentRun, codeReviewVersion, design, implementationSnapshot, localItem, pbiEstimate, planningSnapshot, refinement, runResult, type PowerLoomDb } from "@powerloom/db";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AgentResult } from "../models/AgentResult";
import type { PbiResultKind } from "../models/PbiResultKind";
import type { ResultOwner } from "../models/ResultOwner";
import type { ResultSet } from "../models/ResultSet";
import type { ResultVersion } from "../models/ResultVersion";
import { reviewTaskPrId, reviewTasksOf } from "../reviews/reviews";
import { isCustomTaskType, taskTypeTitle } from "../tasks/customTaskTypes";
import { RESULT_KINDS } from "../tasks/items";
import { versionKey } from "./resultLinks";

type ItemResultRow = Awaited<ReturnType<typeof itemRows>>[number];
type RunResultRow = Awaited<ReturnType<typeof runResultRows>>[number];

const ITEM_TITLES: Record<string, string> = { "research-result": "Research results", "test-report": "Test reports", "support-guide-result": "Demonstration guides" };
const RUN_RESULTS_TITLE = "Run results";

// A PBI's results on its page (user decision 2026-10-21: every version under its task, one shown): its estimates,
// refinements, plans and builds (and the designs from before planning replaced design, when it has any), then each research or
// test task's results, and each task's run results whose run produced
// nothing else shown here (user decision 2026-10-24: decided by the run, not the task type, so an agent made in the UI
// without a refinement or research writer still shows its result).
export async function loadPbiResultSets(db: PowerLoomDb, adoId: number): Promise<ResultSet[]> {
  const [estimates, refinements, plans, builds, designs, items, runResults, shown, kinds] = await Promise.all([
    estimateVersions(db, eq(pbiEstimate.pbiId, adoId)),
    refinementVersions(db, eq(refinement.pbiId, adoId)),
    planVersions(db, eq(planningSnapshot.pbiId, adoId)),
    buildVersions(db, eq(implementationSnapshot.pbiId, adoId)),
    designVersions(db, eq(design.pbiId, adoId)),
    itemRows(db, eq(localItem.pbiId, adoId)),
    runResultRows(db, eq(runResult.pbiId, adoId)),
    runsWithShownResults(db, adoId),
    taskKinds(db, adoId),
  ]);
  const ownOnly = runResults.filter((row) => row.taskId !== null && (row.runId === null || !shown.has(row.runId)));

  return [
    { key: "estimate", title: "Estimate", task: null, versions: estimates, empty: "No agent has estimated it yet." },
    { key: "refinement", title: "Refinement", task: null, versions: refinements, empty: "Not refined yet." },
    { key: "plan", title: "Plan", task: null, versions: plans, empty: "Not planned yet." },
    { key: "build", title: "Build", task: null, versions: builds, empty: "Not implemented yet." },
    ...(designs.length > 0 ? [{ key: "design", title: "Design", task: null, versions: designs, empty: "" }] : []),
    ...itemSets(items),
    ...customTypeSets(ownOnly.filter((row) => isCustomTaskType(kinds.get(row.taskId!) ?? "")), kinds),
    ...runResultSets(ownOnly.filter((row) => !isCustomTaskType(kinds.get(row.taskId!) ?? ""))),
  ];
}

async function taskKinds(db: PowerLoomDb, adoId: number): Promise<Map<string, string>> {
  const rows = await db.select({ id: localItem.id, kind: localItem.kind }).from(localItem).where(eq(localItem.pbiId, adoId));

  return new Map(rows.map((row) => [row.id, row.kind]));
}

// A custom task type's results, shown like a built-in agent's (user decision 2026-10-24): one set per type, titled by it,
// every run's result a version of it, as Refinement or Design are.
function customTypeSets(rows: RunResultRow[], kinds: Map<string, string>): ResultSet[] {
  const byType = new Map<string, RunResultRow[]>();

  for (const row of rows) {
    const type = kinds.get(row.taskId!)!;

    byType.set(type, [...(byType.get(type) ?? []), row]);
  }

  return [...byType].map(([type, own]) => ({ key: `type-${type}`, title: taskTypeTitle(type), task: null, versions: own.map(runResultVersion), empty: "" }));
}

// The runs on a PBI that produced a result the page shows on its own: a refinement, plan, build or design version, a research result
// or test report, a review version. Their run results would show the same thing twice.
async function runsWithShownResults(db: PowerLoomDb, adoId: number): Promise<Set<number>> {
  const [refinements, plans, builds, designs, items, reviews] = await Promise.all([
    db.select({ runId: refinement.runId }).from(refinement).where(eq(refinement.pbiId, adoId)),
    db.select({ runId: planningSnapshot.runId }).from(planningSnapshot).where(eq(planningSnapshot.pbiId, adoId)),
    db.select({ runId: implementationSnapshot.runId }).from(implementationSnapshot).where(eq(implementationSnapshot.pbiId, adoId)),
    db.select({ runId: design.runId }).from(design).where(eq(design.pbiId, adoId)),
    db.select({ runId: localItem.createdByRun }).from(localItem).where(and(eq(localItem.pbiId, adoId), inArray(localItem.kind, RESULT_KINDS))),
    db.select({ runId: codeReviewVersion.runId }).from(codeReviewVersion).innerJoin(agentRun, eq(agentRun.id, codeReviewVersion.runId)).where(eq(agentRun.pbiId, adoId)),
  ]);

  return new Set([...refinements, ...plans, ...builds, ...designs, ...items, ...reviews].map((row) => row.runId).filter((runId): runId is number => runId !== null));
}

// A pull request's reviews (user decision 2026-10-21): one version per successful review run, each rerun being a new
// review task. A review task's page opens on its own newest version (`ownRunIds`), the review page on the latest.
export async function loadReviewResultSet(db: PowerLoomDb, prId: number, ownRunIds: number[] = []): Promise<ResultSet> {
  const versions = await reviewVersions(db, prId);
  const own = versions.filter((version) => version.runId !== null && ownRunIds.includes(version.runId)).at(-1);

  return { key: "review", title: "Review", task: null, versions, empty: "Not reviewed yet.", preferred: own ? versionKey(own) : undefined };
}

// What one task's runs wrote: the refinement, plan, build, design or estimate versions of its runs, the result items answering it,
// its runs' results, or, for a review task, its pull request's reviews (opening on its own run). Estimates keep the
// numbers they have on the PBI page, so they are counted over the whole PBI first.
export async function loadTaskResultSets(db: PowerLoomDb, task: { id: string; pbiId: number | null; kind: string; data: unknown }, runIds: number[]): Promise<ResultSet[]> {
  const prId = task.kind === "review" ? reviewTaskPrId(task.data) : null;
  const [reviews, items, runResults, refinements, plans, builds, designs, estimates] = await Promise.all([
    prId === null ? null : loadReviewResultSet(db, prId, runIds),
    itemRows(db, eq(localItem.parentId, task.id)),
    runResultVersions(db, eq(runResult.taskId, task.id)),
    runIds.length === 0 ? [] : refinementVersions(db, inArray(refinement.runId, runIds)),
    runIds.length === 0 ? [] : planVersions(db, inArray(planningSnapshot.runId, runIds)),
    runIds.length === 0 ? [] : buildVersions(db, inArray(implementationSnapshot.runId, runIds)),
    runIds.length === 0 ? [] : designVersions(db, inArray(design.runId, runIds)),
    runIds.length === 0 || task.pbiId === null ? [] : estimatesOfRuns(db, task.pbiId, runIds),
  ]);
  const sets: ResultSet[] = [
    ...(reviews ? [reviews] : []),
    { key: "run", title: isCustomTaskType(task.kind) ? taskTypeTitle(task.kind) : RUN_RESULTS_TITLE, task: null, versions: runResults, empty: "" },
    { key: "refinement", title: "Refinement", task: null, versions: refinements, empty: "" },
    { key: "plan", title: "Plan", task: null, versions: plans, empty: "" },
    { key: "build", title: "Build", task: null, versions: builds, empty: "" },
    { key: "design", title: "Design", task: null, versions: designs, empty: "" },
    { key: "estimate", title: "Estimate", task: null, versions: estimates, empty: "" },
    ...itemSets(items),
  ];

  return sets.filter((set) => set.versions.length > 0);
}

// The versions beside one result on its full page: the PBI's for a refinement, plan, build, design or estimate, the task's for an
// item or a run result, the pull request's for a review run.
export async function loadSiblingVersions(db: PowerLoomDb, result: AgentResult, owner: ResultOwner): Promise<ResultVersion[]> {
  if (result.kind === "review") {
    return reviewVersions(db, result.row.prId);
  }

  if (result.kind === "item") {
    return owner.taskId === null ? [] : itemSets(await itemRows(db, eq(localItem.parentId, owner.taskId)))[0]?.versions ?? [];
  }

  if (result.kind === "run") {
    return runResultVersions(db, owner.taskId === null ? eq(runResult.id, result.row.id) : eq(runResult.taskId, owner.taskId));
  }

  return owner.pbiId === null ? [] : pbiVersions(db, result.kind, owner.pbiId);
}

// The newest refinement, plan, build, design or estimate of a PBI: what a `PBI-<id>:<kind>` reference links to.
// Null when the PBI has none of that kind yet.
export async function latestPbiVersion(db: PowerLoomDb, kind: PbiResultKind, adoId: number): Promise<ResultVersion | null> {
  const versions = await pbiVersions(db, kind, adoId);

  return versions.at(-1) ?? null;
}

// A PBI's versions of one kind, oldest first.
function pbiVersions(db: PowerLoomDb, kind: PbiResultKind, pbiId: number): Promise<ResultVersion[]> {
  const loaders = {
    refinement: () => refinementVersions(db, eq(refinement.pbiId, pbiId)),
    plan: () => planVersions(db, eq(planningSnapshot.pbiId, pbiId)),
    build: () => buildVersions(db, eq(implementationSnapshot.pbiId, pbiId)),
    design: () => designVersions(db, eq(design.pbiId, pbiId)),
    estimate: () => estimateVersions(db, eq(pbiEstimate.pbiId, pbiId)),
  };

  return loaders[kind]();
}

// Every successful review run of the pull request, with when its version was kept (its start for runs from before).
async function reviewVersions(db: PowerLoomDb, prId: number): Promise<ResultVersion[]> {
  const rows = await db
    .select({ runId: agentRun.id, agent: agentRun.stage, startedAt: agentRun.startedAt, keptAt: codeReviewVersion.createdAt })
    .from(agentRun)
    .innerJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(codeReviewVersion, eq(codeReviewVersion.runId, agentRun.id))
    .where(and(reviewTasksOf(prId), eq(agentRun.outcome, "success")))
    .orderBy(asc(agentRun.id));

  return rows.map((row, index) => ({ kind: "review", id: String(row.runId), label: `v${index + 1}`, runId: row.runId, agent: row.agent, at: row.keptAt ?? row.startedAt, status: null }));
}

async function refinementVersions(db: PowerLoomDb, where: SQL): Promise<ResultVersion[]> {
  const rows = await db
    .select({ id: refinement.id, version: refinement.version, runId: refinement.runId, agent: agentRun.stage, at: refinement.createdAt })
    .from(refinement)
    .leftJoin(agentRun, eq(agentRun.id, refinement.runId))
    .where(where)
    .orderBy(asc(refinement.version));

  return rows.map((row) => ({ kind: "refinement", id: String(row.id), label: `v${row.version}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

async function planVersions(db: PowerLoomDb, where: SQL): Promise<ResultVersion[]> {
  const rows = await db
    .select({ id: planningSnapshot.id, version: planningSnapshot.version, runId: planningSnapshot.runId, agent: agentRun.stage, at: planningSnapshot.createdAt })
    .from(planningSnapshot)
    .leftJoin(agentRun, eq(agentRun.id, planningSnapshot.runId))
    .where(where)
    .orderBy(asc(planningSnapshot.version));

  return rows.map((row) => ({ kind: "plan", id: String(row.id), label: `v${row.version}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

async function buildVersions(db: PowerLoomDb, where: SQL): Promise<ResultVersion[]> {
  const rows = await db
    .select({ id: implementationSnapshot.id, version: implementationSnapshot.version, runId: implementationSnapshot.runId, agent: agentRun.stage, at: implementationSnapshot.createdAt, state: sql<string>`${implementationSnapshot.build}->'handOver'->>'state'` })
    .from(implementationSnapshot)
    .leftJoin(agentRun, eq(agentRun.id, implementationSnapshot.runId))
    .where(where)
    .orderBy(asc(implementationSnapshot.version));

  return rows.map((row) => ({ kind: "build", id: String(row.id), label: `v${row.version}`, runId: row.runId, agent: row.agent, at: row.at, status: row.state }));
}

async function designVersions(db: PowerLoomDb, where: SQL): Promise<ResultVersion[]> {
  const rows = await db
    .select({ id: design.id, version: design.version, runId: design.runId, agent: agentRun.stage, at: design.createdAt })
    .from(design)
    .leftJoin(agentRun, eq(agentRun.id, design.runId))
    .where(where)
    .orderBy(asc(design.version));

  return rows.map((row) => ({ kind: "design", id: String(row.id), label: `v${row.version}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

async function estimatesOfRuns(db: PowerLoomDb, pbiId: number, runIds: number[]): Promise<ResultVersion[]> {
  const all = await estimateVersions(db, eq(pbiEstimate.pbiId, pbiId));

  return all.filter((version) => version.runId !== null && runIds.includes(version.runId));
}

// Estimates have no version number: they count in the order agents recorded them.
async function estimateVersions(db: PowerLoomDb, where: SQL): Promise<ResultVersion[]> {
  const rows = await db
    .select({ id: pbiEstimate.id, runId: pbiEstimate.runId, agent: pbiEstimate.agent, at: pbiEstimate.createdAt })
    .from(pbiEstimate)
    .where(where)
    .orderBy(asc(pbiEstimate.createdAt), asc(pbiEstimate.id));

  return rows.map((row, index) => ({ kind: "estimate", id: String(row.id), label: `v${index + 1}`, runId: row.runId, agent: row.agent, at: row.at, status: null }));
}

function itemRows(db: PowerLoomDb, where: SQL) {
  return db
    .select({ id: localItem.id, kind: localItem.kind, parentId: localItem.parentId, pbiId: localItem.pbiId, runId: localItem.createdByRun, agent: agentRun.stage, at: localItem.createdAt, status: localItem.status })
    .from(localItem)
    .leftJoin(agentRun, eq(agentRun.id, localItem.createdByRun))
    .where(and(where, inArray(localItem.kind, RESULT_KINDS)))
    .orderBy(asc(localItem.id));
}

// Result items grouped by the task they answer, each group in the order its items were written.
function itemSets(rows: ItemResultRow[]): ResultSet[] {
  return [...groupByTask(rows, (row) => row.parentId)].map(([taskId, own]) => ({
    key: taskId,
    title: ITEM_TITLES[own[0].kind] ?? "Results",
    task: { id: taskId, pbiId: own[0].pbiId },
    versions: own.map((row, index) => ({ kind: "item", id: row.id, label: `v${index + 1}`, runId: row.runId, agent: row.agent, at: row.at, status: row.status })),
    empty: "",
  }));
}

// A run result is labelled by its run (user decision 2026-10-22), not counted: one result per run, in the order the
// runs wrote them, so the picker shows the newest run first.
async function runResultVersions(db: PowerLoomDb, where: SQL): Promise<ResultVersion[]> {
  const rows = await runResultRows(db, where);

  return rows.map(runResultVersion);
}

function runResultVersion(row: RunResultRow): ResultVersion {
  return { kind: "run", id: String(row.id), label: row.runId === null ? `#${row.id}` : `RUN-${row.runId}`, runId: row.runId, agent: row.agent, at: row.at, status: row.status };
}

function runResultRows(db: PowerLoomDb, where: SQL) {
  return db
    .select({ id: runResult.id, runId: runResult.runId, taskId: runResult.taskId, pbiId: runResult.pbiId, agent: runResult.agent, status: runResult.status, at: runResult.createdAt })
    .from(runResult)
    .where(where)
    .orderBy(asc(runResult.createdAt), asc(runResult.id));
}

// Run results grouped by their task; the key tells them apart from the task's result items on the same page.
function runResultSets(rows: RunResultRow[]): ResultSet[] {
  return [...groupByTask(rows, (row) => row.taskId)].map(([taskId, own]) => ({
    key: `run-${taskId}`,
    title: RUN_RESULTS_TITLE,
    task: { id: taskId, pbiId: own[0].pbiId },
    versions: own.map(runResultVersion),
    empty: "",
  }));
}

function groupByTask<Row>(rows: Row[], taskOf: (row: Row) => string | null): Map<string, Row[]> {
  const byTask = new Map<string, Row[]>();

  for (const row of rows.filter((candidate) => taskOf(candidate) !== null)) {
    const taskId = taskOf(row)!;

    byTask.set(taskId, [...(byTask.get(taskId) ?? []), row]);
  }

  return byTask;
}

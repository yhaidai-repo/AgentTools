import { setItemStatus, vaultOfPbiSql } from "@powerloom/core";
import { agentRun, localItem, type PowerLoomDb, type workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import { nextId } from "../taskCreation/commitCreatedTasks";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { commitBugs } from "./commitBugs";
import type { AutotestDraft } from "./models/AutotestDraft";
import type { TestReport } from "./models/TestReport";
import { renderTestReport, resolveNewIds } from "./renderTestReport";

const ACTOR = "agent:autotest";
const REPORT_VERSION = 2;

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

// Writes a successful run (stage 2b, 2026-10-23: a granted writer, so the toolset has written the tasks and drafts
// already): the bugs it found (through PowerLoom's bug endpoint) and the report (TR). A complete report closes the
// task; one that waits for an answer (the plan's approval, missing test data) sends the task back to open, held by the
// blocking items it created, so the next run goes on once they close.
export async function commitTestReport(
  deps: Pick<AgentDeps, "db" | "powerloomUrl">,
  task: ItemRow,
  pbi: WorkItemRow,
  runId: number,
  draft: { report: TestReport; bugs: AutotestDraft["bugs"] },
  created: { tasks: CreatedTask[]; taskIds: string[] },
  extra: { commits: Record<string, string>; docsRead: string[]; docsVault: string },
): Promise<string[]> {
  const { db } = deps;
  const pbiId = pbi.adoId;
  const bugIds = await commitBugs(deps.powerloomUrl, pbiId, draft.bugs);
  const report = withResolvedIds(draft.report, created.taskIds, bugIds);
  const data = { report, reportVersion: REPORT_VERSION, next: { taskIds: created.taskIds, reason: report.nextReason }, bugIds, commits: extra.commits, docsRead: extra.docsRead };
  const reportId = await insertReport(db, task, pbiId, runId, renderTestReport(report, created.taskIds, bugIds), data);
  const outputs = [reportId, ...bugIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await settleTask(db, task, runId, report, blockingIds(created.tasks, created.taskIds));

  return outputs;
}

async function insertReport(db: PowerLoomDb, task: ItemRow, pbiId: number, runId: number, body: string, data: object): Promise<string> {
  const id = await nextId(db, "TR", pbiId);

  await db.insert(localItem).values({ id, kind: "test-report", pbiId, vault: vaultOfPbiSql(pbiId), parentId: task.id, title: `Test report: ${task.title}`.slice(0, 120), status: "final", assignee: ACTOR, body, data, createdByRun: runId });

  return id;
}

// Done when the report is complete or nothing it created can change it; otherwise open again, waiting for the
// blocking items (data.dependsOn, checked by the dispatcher's validation).
async function settleTask(db: PowerLoomDb, task: ItemRow, runId: number, report: TestReport, blocking: string[]): Promise<void> {
  if (report.status === "complete" || blocking.length === 0) {
    await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);

    return;
  }

  // Read again: the user may have saved notes on the task while the run worked (user decision 2026-10-21).
  const [current] = await db.select({ data: localItem.data }).from(localItem).where(eq(localItem.id, task.id));
  const data = (current?.data ?? {}) as { dependsOn?: string[] };
  const dependsOn = [...new Set([...(data.dependsOn ?? []), ...blocking])];

  await db.update(localItem).set({ data: { ...data, dependsOn } }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", "open", ACTOR, runId);
}

function blockingIds(tasks: CreatedTask[], taskIds: string[]): string[] {
  return tasks.flatMap((created, index) => created.blocking && taskIds[index] ? [taskIds[index]] : []);
}

function withResolvedIds(report: TestReport, taskIds: string[], bugIds: string[]): TestReport {
  const resolve = (text: string) => resolveNewIds(text, taskIds, bugIds);

  return {
    ...report,
    summary: resolve(report.summary),
    analysis: report.analysis.map((finding) => ({ ...finding, detail: resolve(finding.detail), resolution: resolve(finding.resolution) })),
    cases: report.cases.map((planned) => ({ ...planned, data: resolve(planned.data), expected: resolve(planned.expected), blockedBy: planned.blockedBy === null ? null : resolve(planned.blockedBy) })),
    results: report.results.map((result) => ({ ...result, observed: resolve(result.observed), bug: result.bug === null ? null : resolve(result.bug) })),
  };
}

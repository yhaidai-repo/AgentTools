import { vaultOfPbiSql } from "@powerloom/core";
import { localItem, type PowerLoomDb, type workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import { nextId } from "../taskCreation/commitCreatedTasks";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { commitBugs } from "./commitBugs";
import { addRunOutputs } from "../tasks/runOutputs";
import type { AutotestDraft } from "./models/AutotestDraft";
import type { TestReport } from "./models/TestReport";
import { renderTestReport, resolveNewIds } from "./renderTestReport";

const ACTOR = "agent:autotest";
const REPORT_VERSION = 2;

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

// Writes a successful run (stage 2b, 2026-10-23: a granted writer, so the toolset has written the tasks and drafts
// already): the bugs it found (through PowerLoom's bug endpoint) and the report (TR). Returns the blocking items it
// created (the plan's approval, missing test data): a report that isn't complete waits for those, not for every task
// (the generic executor settles the task).
export async function commitTestReport(
  deps: Pick<AgentDeps, "db" | "powerloomUrl">,
  task: ItemRow,
  pbi: WorkItemRow,
  runId: number,
  draft: { report: TestReport; bugs: AutotestDraft["bugs"] },
  created: { tasks: CreatedTask[]; taskIds: string[] },
  extra: { commits: Record<string, string>; docsRead: string[]; docsVault: string },
): Promise<{ blocking: string[] }> {
  const { db } = deps;
  const pbiId = pbi.adoId;
  const bugIds = await commitBugs(deps.powerloomUrl, pbiId, draft.bugs, task.id);
  const report = withResolvedIds(draft.report, created.taskIds, bugIds);
  const data = { report, reportVersion: REPORT_VERSION, next: { taskIds: created.taskIds, reason: report.nextReason }, bugIds, commits: extra.commits, docsRead: extra.docsRead };
  const reportId = await insertReport(db, task, pbiId, runId, renderTestReport(report, created.taskIds, bugIds), data);
  const outputs = [reportId, ...bugIds];

  await addRunOutputs(db, runId, outputs);

  return { blocking: report.status === "complete" ? [] : blockingIds(created.tasks, created.taskIds) };
}

async function insertReport(db: PowerLoomDb, task: ItemRow, pbiId: number, runId: number, body: string, data: object): Promise<string> {
  const id = await nextId(db, "TR", pbiId);

  await db.insert(localItem).values({ id, kind: "test-report", pbiId, vault: vaultOfPbiSql(pbiId), parentId: task.id, title: `Test report: ${task.title}`.slice(0, 120), status: "final", assignee: ACTOR, body, data, createdByRun: runId });

  return id;
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

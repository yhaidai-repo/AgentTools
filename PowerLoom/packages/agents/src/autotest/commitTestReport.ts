import { setItemStatus, vaultOfPbiSql } from "@powerloom/core";
import { agentRun, localItem, type PowerLoomDb, type workItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { commitCreatedTasks, nextId } from "../taskCreation/commitCreatedTasks";
import { commitCaptures } from "../vaultCapture";
import type { AutotestDraft } from "./models/AutotestDraft";
import type { TestReport } from "./models/TestReport";
import { renderTestReport, resolveNewIds } from "./renderTestReport";

const ACTOR = "agent:autotest";
const REPORT_VERSION = 1;

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

// Writes a successful run: the report (TR), the tasks it created and its drafts. A complete report closes the task;
// one that waits for an answer (the plan's approval, missing test data) sends the task back to open, held by the
// blocking items it created, so the next run goes on once they close (as design's gaps do).
export async function commitTestReport(
  db: PowerLoomDb,
  task: ItemRow,
  pbi: WorkItemRow,
  runId: number,
  draft: AutotestDraft & { report: TestReport },
  extra: { commits: Record<string, string>; docsRead: string[]; docsVault: string },
): Promise<string[]> {
  const pbiId = pbi.adoId;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);
  const taskIds = await commitCreatedTasks(db, { pbiId, vault: task.vault, parentTaskId: task.id, runId, depth, docsVault: extra.docsVault }, draft.tasks);
  const report = withResolvedIds(draft.report, taskIds);
  const data = { report, reportVersion: REPORT_VERSION, next: { taskIds, reason: report.nextReason }, commits: extra.commits, docsRead: extra.docsRead };
  const reportId = await insertReport(db, task, pbiId, runId, renderTestReport(report, taskIds), data);
  const captureIds = await commitCaptures(db, runId, pbiId, task.id, draft.captures);
  const outputs = [reportId, ...taskIds, ...captureIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await settleTask(db, task, runId, report, blockingIds(draft, taskIds));

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

  const data = (task.data ?? {}) as { dependsOn?: string[] };
  const dependsOn = [...new Set([...(data.dependsOn ?? []), ...blocking])];

  await db.update(localItem).set({ data: { ...data, dependsOn } }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", "open", ACTOR, runId);
}

function blockingIds(draft: AutotestDraft, taskIds: string[]): string[] {
  return draft.tasks.flatMap((created, index) => created.blocking && taskIds[index] ? [taskIds[index]] : []);
}

function withResolvedIds(report: TestReport, taskIds: string[]): TestReport {
  return {
    ...report,
    summary: resolveNewIds(report.summary, taskIds),
    analysis: report.analysis.map((finding) => ({ ...finding, detail: resolveNewIds(finding.detail, taskIds), resolution: resolveNewIds(finding.resolution, taskIds) })),
    cases: report.cases.map((planned) => ({ ...planned, data: resolveNewIds(planned.data, taskIds), expected: resolveNewIds(planned.expected, taskIds), blockedBy: planned.blockedBy === null ? null : resolveNewIds(planned.blockedBy, taskIds) })),
  };
}

import { localItem, workItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import { docsReadInRun } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterRunContext } from "../toolset/models/WriterRunContext";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { createBugTool } from "./bugTool";
import { commitTestReport } from "./commitTestReport";
import type { AutotestDraft } from "./models/AutotestDraft";
import { createReportTool } from "./reportTool";
import { buildTestMessage } from "./testMessage";

type ItemRow = typeof localItem.$inferSelect;
type WorkItemRow = typeof workItem.$inferSelect;

export const AUTOTEST_INTEGRATION = "writeTestReports";

// Autotest's tools as a granted writer (stage 2b, 2026-10-23): write_test_report and report_bug; the first message
// carries the PBI's test cases, its design and refinement and the previous report. The report (TR) and the bugs are
// written once the run succeeds; a report that waits for an answer sends the task back to open.
export class AutotestWriter implements RunWriter {
  private readonly draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };
  private pbi: WorkItemRow | null = null;

  constructor(private readonly context: TaskContext) {}

  tools(log: ReadLog): ToolDefinition<any>[] {
    return [createReportTool(this.draft, log), createBugTool(this.draft, log)];
  }

  async contextBlocks(task: ItemRow, run: WriterRunContext): Promise<string[]> {
    const { deps } = this.context;

    this.pbi = await loadPbi(this.context, task);

    return [await buildTestMessage(deps.db, deps.vaultRoot, task, this.pbi, run.repos)];
  }

  // The commit lists the report and bugs as the run's outputs itself, so nothing is returned to list twice.
  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.draft.report || !this.pbi) {
      return [];
    }

    const { deps } = target;
    const extra = { commits: target.repos.commits, docsRead: await docsReadInRun(deps, target.runId), docsVault: deps.docsVaultName };

    await commitTestReport(deps, target.task, this.pbi, target.runId, { report: this.draft.report, bugs: this.draft.bugs }, { tasks: target.tasks, taskIds: target.taskIds }, extra);

    return [];
  }
}

// A test task always belongs to a PBI (TaskCreation requires one; create_task's test target is PBI-scoped).
async function loadPbi(context: TaskContext, task: ItemRow): Promise<WorkItemRow> {
  const [pbi] = task.pbiId === null ? [] : await context.deps.db.select().from(workItem).where(eq(workItem.adoId, task.pbiId));

  if (!pbi) {
    throw new Error(`${task.id} has no PBI; a test task needs one.`);
  }

  return pbi;
}

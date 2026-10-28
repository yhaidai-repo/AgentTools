import { requirePbiId } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import { loadResearchContext } from "../research/loadResearchContext";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { USER } from "../taskCreation/taskTargets";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import type { WriterWorkspace } from "../toolset/models/WriterWorkspace";
import { IMPLEMENT_TASK_TYPE, commitPlan, markReviewReaders } from "./commitPlan";
import type { PlanDraft } from "./models/PlanDraft";
import type { PlanningFolder } from "./models/PlanningFolder";
import type { PlanningOutcome } from "./models/PlanningOutcome";
import type { PreparedPlanning } from "./models/PreparedPlanning";
import { buildPlanContext } from "./planMessage";
import { createPlanTools } from "./planTools";
import { planningDocsOnly } from "./planningDocsOnly";
import { planningSeed } from "./planningSeed";
import { planningWorkspace, workspaceBlock } from "./planningWorkspace";
import { WorktreePlanningFolder } from "./WorktreePlanningFolder";

type ItemRow = typeof localItem.$inferSelect;

export const WRITE_PLAN_INTEGRATION = "writePlan";

// The planning agent's output (user decisions 2026-10-28/29, replacing design): GSD discusses and plans in the PBI's
// worktree, write_plan stores the plan it left in .planning/, and the run hands the plan to a person for review and the
// implementation task on behind that review's gate. Without a plan, only its questions (hand_off, intent ask) hold the
// task open.
export class PlanWriter implements RunWriter {
  readonly integration = WRITE_PLAN_INTEGRATION;
  commitDraft(): unknown { return this.draft; }

  private readonly draft: PlanDraft = { plan: null };
  private prepared: Promise<PreparedPlanning> | null = null;
  private outcome: PlanningOutcome = { hasAsked: false, hasReview: false, hasImplementation: false };

  constructor(private readonly context: TaskContext, private readonly folderAt: (worktree: string) => PlanningFolder = (worktree) => new WorktreePlanningFolder(worktree)) {}

  tools(log: ReadLog): ToolDefinition<any>[] {
    return createPlanTools(this.draft, () => this.runFolder());
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    const { context, workspace } = await this.prepare(task);

    return [context, workspaceBlock(workspace)];
  }

  async workspace(task: ItemRow): Promise<WriterWorkspace | null> {
    const { workspace } = await this.prepare(task);

    return workspace ? { workspace, toolPolicy: planningDocsOnly } : null;
  }

  async commit(target: WriterTarget): Promise<string[]> {
    const implementationIds = target.tasks.flatMap((task, index) => (task.assignee === IMPLEMENT_TASK_TYPE ? [target.taskIds[index]] : []));

    this.outcome = handoffOutcome(target);

    if (this.draft.plan) {
      await commitPlan(target.deps.db, requirePbiId(target.task), target.runId, this.draft.plan, await this.pbiContentHash());
    }

    await markReviewReaders(target.deps.db, implementationIds);

    return [];
  }

  // A plan goes to review and implementation waits behind it; without a plan, the questions that stop it hold the task.
  settlement(): WriterSettlement | null {
    if (!this.draft.plan) {
      return this.outcome.hasAsked ? null : { kind: "missing", output: "a plan (write_plan) or the questions that stop it (hand_off to a person, intent ask)" };
    }

    if (!this.outcome.hasReview) {
      return { kind: "missing", output: "the plan review (hand_off to a person, intent review, gate approve)" };
    }

    return this.outcome.hasImplementation ? null : { kind: "missing", output: `the implementation task (hand_off to ${IMPLEMENT_TASK_TYPE}, depends_on the review)` };
  }

  // The PBI's content as the run planned from it; null for a writer that never prepared (nothing was planned from it).
  private async pbiContentHash(): Promise<string | null> {
    return this.prepared ? (await this.prepared).pbiContentHash : null;
  }

  private prepare(task: ItemRow): Promise<PreparedPlanning> {
    this.prepared ??= this.preparePlanning(task);

    return this.prepared;
  }

  private async preparePlanning(task: ItemRow): Promise<PreparedPlanning> {
    const { deps } = this.context;
    const research = await loadResearchContext(deps, task);
    const context = await buildPlanContext(deps.db, deps.vaultRoot, research);

    return { context, workspace: await planningWorkspace(deps.db, research.pbi, planningSeed(context)), pbiContentHash: research.pbi.contentHash };
  }

  private runFolder(): PlanningFolder | null {
    const worktree = this.context.deps.runWorktree?.current;

    return worktree ? this.folderAt(worktree.path) : null;
  }
}

function handoffOutcome(target: WriterTarget): PlanningOutcome {
  const reviewRefs = target.tasks.flatMap((task, index) => (isPlanReview(task) ? [`new:${index + 1}`, target.taskIds[index]] : []));
  const isGatedImplementation = (task: CreatedTask) => task.assignee === IMPLEMENT_TASK_TYPE && task.dependsOn.some((ref) => reviewRefs.includes(ref));

  return {
    hasAsked: target.handoffs.some((handoff) => handoff.intent === "ask"),
    hasReview: reviewRefs.length > 0,
    hasImplementation: target.tasks.some(isGatedImplementation),
  };
}

function isPlanReview(task: CreatedTask): boolean {
  return task.assignee === USER && task.handoff?.intent === "review" && task.handoff.gate === "approve";
}

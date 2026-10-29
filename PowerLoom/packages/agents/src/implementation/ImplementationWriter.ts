import { requirePbiId } from "@powerloom/core";
import type { BuildContent, localItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import { loadResearchContext } from "../research/loadResearchContext";
import { USER } from "../taskCreation/taskTargets";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import type { WriterWorkspace } from "../toolset/models/WriterWorkspace";
import { settlementBlocker } from "./buildGate";
import { commitBuild, holdReason, noteHandOver } from "./commitBuild";
import { PLANNING_TASK_TYPE, implementationBlock } from "./implementationBlock";
import { createImplementationTools } from "./implementationTools";
import { implementationPolicy } from "./implementationPolicy";
import type { BuildDraft } from "./models/BuildDraft";
import type { BuildSource } from "./models/BuildSource";
import type { BuildTarget } from "./models/BuildTarget";
import type { ImplementationHandoffs } from "./models/ImplementationHandoffs";
import type { PreparedImplementation } from "./models/PreparedImplementation";
import type { ReviewOutcome } from "./models/ReviewOutcome";
import { prepareImplementation } from "./prepareImplementation";
import { WorktreeBuildSource } from "./WorktreeBuildSource";

type ItemRow = typeof localItem.$inferSelect;

export const WRITE_IMPLEMENTATION_INTEGRATION = "writeImplementation";

// The implementation agent's output (wave 3, user decisions 2026-10-28/29): the review outcome first; an approved plan is
// executed by GSD on the PBI branch in the run's worktree, write_implementation stores what was built, and the run hands
// the branch to a person who reviews it, pushes it and opens the pull request (the agent never pushes). Changes go back
// to planning; a review that never approved stops the task for a person.
export class ImplementationWriter implements RunWriter {
  readonly integration = WRITE_IMPLEMENTATION_INTEGRATION;
  commitDraft(): unknown { return this.draft; }

  private readonly draft: BuildDraft = { build: null };
  private prepared: Promise<PreparedImplementation> | null = null;
  private outcome: ReviewOutcome | null = null;
  private handoffs: ImplementationHandoffs = { hasPlanning: false, handOverId: null };

  constructor(
    private readonly context: TaskContext,
    private readonly sourceAt: (worktree: string) => BuildSource = (worktree) => new WorktreeBuildSource(worktree),
    private readonly prepareFor: (task: ItemRow) => Promise<PreparedImplementation> = (task) => prepareFromDb(context, task),
  ) {}

  tools(log: ReadLog): ToolDefinition<any>[] {
    return createImplementationTools(this.draft, () => this.buildTarget());
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    return [implementationBlock(await this.prepare(task))];
  }

  // Only an approved plan gets the worktree, so a run that hands back or stops can't touch the code.
  async workspace(task: ItemRow): Promise<WriterWorkspace | null> {
    const { workspace } = await this.prepare(task);

    return workspace ? { workspace, toolPolicy: implementationPolicy } : null;
  }

  async commit(target: WriterTarget): Promise<string[]> {
    this.handoffs = implementationHandoffs(target);

    if (!this.draft.build) {
      return [];
    }

    const content = withHandOverItem(this.draft.build.content, this.handoffs.handOverId);

    await commitBuild(target.deps.db, requirePbiId(target.task), target.runId, { content, inspect: this.draft.build.inspect });
    await this.handOver(target, content);

    return [];
  }

  // Approved: the build and its hand-over, blocked when no plan got done or a configured build never passed (pilot runs
  // 4464-4486 closed unbuilt hand-overs as done); changes: the planning task; never approved: blocked for a person.
  settlement(): WriterSettlement | null {
    if (this.outcome?.kind === "blocked") {
      return { kind: "blocked", reason: this.outcome.reason };
    }

    if (this.outcome?.kind === "replan") {
      return this.handoffs.hasPlanning ? null : { kind: "missing", output: `the planning task (hand_off to ${PLANNING_TASK_TYPE}, intent continue, with the review's changes)` };
    }

    return this.outcome ? this.approvedSettlement() : null;
  }

  private approvedSettlement(): WriterSettlement | null {
    if (!this.draft.build) {
      return { kind: "missing", output: "the implementation (write_implementation)" };
    }

    const blocker = settlementBlocker(this.draft.build.content);

    if (blocker) {
      return { kind: "blocked", reason: blocker };
    }

    return this.handoffs.handOverId ? null : { kind: "missing", output: "the hand-over (hand_off to a person, intent review: review the branch, push it, open the pull request)" };
  }

  // The hand-over task gets the branch and the pull request, and the worktree is held until that task closes (user
  // decision 2026-10-29). A hold that fails doesn't undo the stored build: nothing removes a branch's worktree today.
  private async handOver(target: WriterTarget, content: BuildContent): Promise<void> {
    const handOverId = this.handoffs.handOverId;

    if (!handOverId) {
      return;
    }

    await noteHandOver(target.deps.db, handOverId, content);

    try {
      await target.deps.repoCache.holdWorktree(content.worktree, holdReason(handOverId));
    } catch (error) {
      console.error(`holding worktree ${content.worktree} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private prepare(task: ItemRow): Promise<PreparedImplementation> {
    this.prepared ??= this.prepareRun(task);

    return this.prepared;
  }

  private async prepareRun(task: ItemRow): Promise<PreparedImplementation> {
    const prepared = await this.prepareFor(task);

    this.outcome = prepared.outcome;

    return prepared;
  }

  private async buildTarget(): Promise<BuildTarget | null> {
    const worktree = this.context.deps.runWorktree?.current;
    const prepared = this.prepared ? await this.prepared : null;

    if (!worktree || prepared?.outcome.kind !== "approved" || !prepared.workspace) {
      return null;
    }

    const { workspace, commands, outcome } = prepared;
    const place = { repo: workspace.repo.name, branch: workspace.branch, baseBranch: workspace.baseBranch, worktree: worktree.path, planVersion: outcome.planVersion, commands };

    return { source: this.sourceAt(worktree.path), place, buildRuns: this.context.deps.runBuildLog?.runs ?? [] };
  }
}

async function prepareFromDb(context: TaskContext, task: ItemRow): Promise<PreparedImplementation> {
  const { pbi } = await loadResearchContext(context.deps, task);

  return prepareImplementation(context.deps.db, task, pbi);
}

// The run's planning task (the changes handed back) and its person's hand-over task.
function implementationHandoffs(target: WriterTarget): ImplementationHandoffs {
  const handOverIndex = target.tasks.findIndex((task) => task.assignee === USER && task.handoff?.intent === "review");

  return {
    hasPlanning: target.tasks.some((task) => task.assignee === PLANNING_TASK_TYPE && task.handoff?.intent === "continue"),
    handOverId: handOverIndex < 0 ? null : target.taskIds[handOverIndex],
  };
}

function withHandOverItem(content: BuildContent, itemId: string | null): BuildContent {
  return { ...content, handOver: { ...content.handOver, itemId } };
}

import { isRecommendableSkill, requirePbiId } from "@powerloom/core";
import { localItem, workItem } from "@powerloom/db";
import { createListSkillsTool, listSkills, type ToolDefinition } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { documentedRepos } from "../docsRepos";
import type { RunEstimate } from "../estimate/RunEstimate";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import { buildPbiMessage } from "../refinement/pbiMessage";
import { withPagesRead } from "../relevantPages";
import { confluencePagesReadInRun, docsReadInRun } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { SharedRunState } from "../toolset/models/SharedRunState";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { commitBetterRefinement } from "./commitBetterRefinement";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import { createRefinementTool } from "./refinementTool";

type ItemRow = typeof localItem.$inferSelect;

export const WRITE_REFINEMENT_INTEGRATION = "writeRefinement";

// Better Refinement's tools as a granted writer (stage 2b, 2026-10-23): write_refinement with the skills it may
// recommend; the first message carries the PBI as the refinement agents read it. Refinement must estimate when its
// Config grants it (user decision 2026-10-18): write_refinement refuses until record_estimate was called.
export class RefinementWriter implements RunWriter {
  readonly integration = WRITE_REFINEMENT_INTEGRATION;
  commitDraft(): unknown { return this.draft; }

  private readonly draft: BetterRefinementDraft = { refinement: null, captures: [], pages: [] };
  private recommendable: string[] | null = null;
  private carriedOnBy: string | null = null;

  constructor(private readonly context: TaskContext) {}

  tools(log: ReadLog, shared: SharedRunState): ToolDefinition<any>[] {
    if (this.recommendable === null) {
      throw new Error("the refinement writer lists the skills with its first-message blocks before its tools");
    }

    const { deps } = this.context;

    return [createListSkillsTool(deps.skillFolders, isRecommendableSkill), withEstimateFirst(createRefinementTool(this.draft, log, this.recommendable, shared.tasks), shared.estimate)];
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    const { deps } = this.context;
    const [row] = await deps.db.select().from(workItem).where(eq(workItem.adoId, requirePbiId(task)));

    this.recommendable = (await listSkills(deps.skillFolders)).skills.map((skill) => skill.name).filter(isRecommendableSkill);

    return row ? [await buildPbiMessage(deps.db, deps.vaultRoot, row)] : [];
  }

  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.draft.refinement) {
      return [];
    }

    const { deps } = target;
    const pages = withPagesRead(this.draft.pages, await confluencePagesReadInRun(deps, target.runId), "Read by Better Refinement while refining.");
    const extra = { docsRead: await docsReadInRun(deps, target.runId), documented: await documentedRepos(deps.docsRoot), docsVault: deps.docsVaultName, stoppedEarly: target.stoppedEarly };
    const task = { id: target.task.id, pbiId: requirePbiId(target.task), vault: target.task.vault };
    const committed = await commitBetterRefinement(deps.db, task, target.runId, { refinement: this.draft.refinement, pages }, { tasks: target.tasks, taskIds: target.taskIds }, extra);

    this.carriedOnBy = committed.carriedOnBy;

    return committed.outputs;
  }

  // The refinement is the task's output; a follow-up refinement that waits for the user's answers carries it on.
  settlement(): WriterSettlement | null {
    if (!this.draft.refinement) {
      return { kind: "missing", output: "a refinement (write_refinement)" };
    }

    return this.carriedOnBy ? { kind: "handedOn", id: this.carriedOnBy } : null;
  }
}

function withEstimateFirst(tool: ToolDefinition<any>, estimate: RunEstimate): ToolDefinition<any> {
  return {
    ...tool,
    handler: async (input) => (estimate.isMissing ? { text: "Not saved: record the estimate first (record_estimate, both values), then call write_refinement again.", isError: true } : tool.handler(input)),
  };
}

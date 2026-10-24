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

  private readonly draft: BetterRefinementDraft = { refinement: null, tasks: [], captures: [], pages: [] };
  private recommendable: string[] | null = null;

  constructor(private readonly context: TaskContext) {}

  tools(log: ReadLog, shared: SharedRunState): ToolDefinition<any>[] {
    if (this.recommendable === null) {
      throw new Error("the refinement writer lists the skills with its first-message blocks before its tools");
    }

    const { deps } = this.context;

    return [createListSkillsTool(deps.skillFolders, isRecommendableSkill), withEstimateFirst(createRefinementTool(this.draft, log, this.recommendable), shared.estimate)];
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
    const extra = { docsRead: await docsReadInRun(deps, target.runId), documented: await documentedRepos(deps.docsRoot), docsVault: deps.docsVaultName };
    const task = { id: target.task.id, pbiId: requirePbiId(target.task), vault: target.task.vault };

    return commitBetterRefinement(deps.db, task, target.runId, target.agentId, { refinement: this.draft.refinement, pages }, { tasks: target.tasks, taskIds: target.taskIds }, extra);
  }
}

function withEstimateFirst(tool: ToolDefinition<any>, estimate: RunEstimate): ToolDefinition<any> {
  return {
    ...tool,
    handler: async (input) => (estimate.isMissing ? { text: "Not saved: record the estimate first (record_estimate, both values), then call write_refinement again." } : tool.handler(input)),
  };
}

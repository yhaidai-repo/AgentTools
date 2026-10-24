import type { ToolDefinition } from "@agenttools/runtime";
import type { ReadLog } from "../evidence/ReadLog";
import { docsReadInRun } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { commitResearchResult } from "./commitBetterResearch";
import type { BetterResearchDraft } from "./models/BetterResearchDraft";
import { createResultTool } from "./resultTool";

export const RESEARCH_RESULT_INTEGRATION = "researchResult";

// write_research_result as a granted writer (stage 2b, 2026-10-23): the research result item (RR) of the run's task, its
// relevant pages, the task closed. Any agent with the grant gets it; Better Research no longer needs code of its own.
export class ResearchResultWriter implements RunWriter {
  private readonly draft: BetterResearchDraft = { result: null, tasks: [], captures: [], pages: [] };

  tools(log: ReadLog): ToolDefinition<any>[] {
    return [createResultTool(this.draft, log)];
  }

  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.draft.result) {
      return [];
    }

    const extra = { commits: target.repos.commits, docsRead: await docsReadInRun(target.deps, target.runId), docsVault: target.deps.docsVaultName };

    return commitResearchResult(target.deps.db, target.task, target.runId, target.agentId, { result: this.draft.result, pages: this.draft.pages }, target.taskIds, extra);
  }
}

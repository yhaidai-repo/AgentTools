import { requirePbiId } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import { DuplicateGuard } from "../DuplicateGuard";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import { withPagesRead } from "../relevantPages";
import { loadResearchContext } from "../research/loadResearchContext";
import { confluencePagesReadInRun } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { commitDesign } from "./commitDesign";
import { buildDesignMessage } from "./designMessage";
import { createDesignTools } from "./designTools";
import type { DesignDraft } from "./models/DesignDraft";

type ItemRow = typeof localItem.$inferSelect;

export const WRITE_DESIGN_INTEGRATION = "writeDesign";

// The design agent's tools as a granted writer (stage 2b, 2026-10-23): write_design and the questions that stop a
// design; the first message carries the PBI, its refinement and every research result. With a design the task is
// done; without one it waits, open, until its gaps close (commitDesign). Drafts go through the toolset's vault_capture.
export class DesignWriter implements RunWriter {
  private readonly draft: DesignDraft = { design: null, gaps: [], captures: [], pages: [] };
  private guard: DuplicateGuard | null = null;

  constructor(private readonly context: TaskContext) {}

  tools(log: ReadLog): ToolDefinition<any>[] {
    if (!this.guard) {
      throw new Error("the design writer's duplicate guard is loaded with its first-message blocks before its tools");
    }

    return createDesignTools(this.draft, this.guard);
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    const { deps } = this.context;
    const research = await loadResearchContext(deps, task);

    this.guard = await DuplicateGuard.load(deps.db, requirePbiId(task));

    return [await buildDesignMessage(deps.db, deps.vaultRoot, research)];
  }

  // The commit lists the design and the gap items as the run's outputs itself, so nothing is returned to list twice.
  async commit(target: WriterTarget): Promise<string[]> {
    const pages = withPagesRead(this.draft.pages, await confluencePagesReadInRun(target.deps, target.runId), "Read by design while designing.");

    await commitDesign(target.deps.db, target.task, requirePbiId(target.task), target.runId, { ...this.draft, pages });

    return [];
  }
}

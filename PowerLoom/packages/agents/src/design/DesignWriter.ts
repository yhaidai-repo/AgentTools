import { requirePbiId } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import { withPagesRead } from "../relevantPages";
import { loadResearchContext } from "../research/loadResearchContext";
import { confluencePagesReadInRun } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { commitDesign } from "./commitDesign";
import { buildDesignMessage } from "./designMessage";
import { createDesignTools } from "./designTools";
import type { DesignDraft } from "./models/DesignDraft";

type ItemRow = typeof localItem.$inferSelect;

export const WRITE_DESIGN_INTEGRATION = "writeDesign";

// The design agent's tools as a granted writer (stage 2b, 2026-10-23): write_design and the questions that stop a
// design; the first message carries the PBI, its refinement and every research result. With a design the task is
// done; without one it settles by what it handed off (the questions that stop it). Drafts go through the toolset's
// vault_capture.
export class DesignWriter implements RunWriter {
  readonly integration = WRITE_DESIGN_INTEGRATION;
  commitDraft(): unknown { return this.draft; }

  private readonly draft: DesignDraft = { design: null, captures: [], pages: [] };
  private hasHandedOff = false;

  constructor(private readonly context: TaskContext) {}

  tools(log: ReadLog): ToolDefinition<any>[] {
    return createDesignTools(this.draft);
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    const { deps } = this.context;
    const research = await loadResearchContext(deps, task);

    return [await buildDesignMessage(deps.db, deps.vaultRoot, research)];
  }

  // The commit lists the design as the run's outputs itself, so nothing is returned to list twice.
  async commit(target: WriterTarget): Promise<string[]> {
    const pages = withPagesRead(this.draft.pages, await confluencePagesReadInRun(target.deps, target.runId), "Read by design while designing.");

    this.hasHandedOff = target.handoffs.length > 0;
    await commitDesign(target.deps.db, target.task, requirePbiId(target.task), target.runId, { ...this.draft, pages });

    return [];
  }

  // A design is the task's output; without one, what it handed off settles the task (it waits for what it asked).
  settlement(): WriterSettlement | null {
    if (this.draft.design || this.hasHandedOff) {
      return null;
    }

    return { kind: "missing", output: "a design (write_design) or the questions that stop it (hand_off to a person)" };
  }
}

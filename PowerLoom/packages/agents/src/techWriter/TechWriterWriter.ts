import type { ToolDefinition } from "@agenttools/runtime";
import type { localItem } from "@powerloom/db";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReadLog } from "../evidence/ReadLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { commitActualize, commitTechWriter } from "./commitTechWriter";
import { dependenciesBlock } from "./dependenciesBlock";
import { relinkDraft, requireNoDraftLinks } from "./draftLinks";
import type { DraftTaskData } from "./models/DraftTaskData";
import type { TaskVault } from "./models/TaskVault";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import { modeOf, taskVault } from "./taskVault";
import { techWriterMessage } from "./techWriterMessage";
import { createTechWriterTools } from "./techWriterTools";

type ItemRow = typeof localItem.$inferSelect;

export const WRITE_NOTES_INTEGRATION = "writeNotes";

// The tech-writer's tools as a granted writer (stage 2b, 2026-10-23): write_note, findings and draft handling in the
// task's vault; the notes are applied once the run succeeds. A run that handed work on with create_task merges nothing
// (user decision 2026-10-14): the generic executor puts the task back to open, and it runs again with the results.
export class TechWriterWriter implements RunWriter {
  readonly integration = WRITE_NOTES_INTEGRATION;

  private readonly draft: TechWriterDraft = { edits: [], findings: [], home: null, summary: null };

  constructor(private readonly deps: AgentDeps) {}

  tools(log: ReadLog): ToolDefinition<any>[] {
    return createTechWriterTools(this.deps, this.draft);
  }

  async contextBlocks(task: ItemRow): Promise<string[]> {
    const vault = taskVault(this.deps, task);

    return [await techWriterMessage(vault, task), await dependenciesBlock(this.deps.db, task)].filter(Boolean);
  }

  // The vault's own rules go with the instructions: every note it writes follows them.
  async promptSections(task: ItemRow): Promise<string[]> {
    const vault = taskVault(this.deps, task);
    const rules = await readFile(join(vault.root, "AGENTS.md"), "utf8");

    return [`## Vault rules (the ${vault.name} vault's AGENTS.md)\n\n${rules}`];
  }

  async commit(target: WriterTarget): Promise<string[]> {
    if (target.taskIds.length > 0) {
      return [];
    }

    const vault = taskVault(this.deps, target.task);

    this.draft.summary = target.result?.body ?? null;

    return this.commitNotes(vault, target.task, target.runId);
  }

  // The commits list the notes written as the run's outputs themselves, so nothing is returned to list twice.
  private async commitNotes(vault: TaskVault, task: ItemRow, runId: number): Promise<string[]> {
    if (modeOf(task) !== "draft") {
      await commitActualize(this.deps.db, vault, task, runId, this.draft);

      return [];
    }

    const draftName = (task.data as DraftTaskData).draft;
    const edits = await relinkDraft(vault.root, draftName, this.draft);

    await requireNoDraftLinks(vault.root, draftName, edits);
    await commitTechWriter(this.deps.db, vault, task, runId, { ...this.draft, edits });

    return [];
  }
}

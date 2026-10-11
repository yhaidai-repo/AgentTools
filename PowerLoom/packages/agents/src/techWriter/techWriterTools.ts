import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { createFindingTools } from "../findingTools";
import type { AgentDeps } from "../models/AgentDeps";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import { hasFrontmatter } from "./noteAuthors";
import { normalizeNotePath, notePathProblem } from "./notePaths";

// Pipeline tools of the tech-writer. They only fill the draft; nothing is written until the run succeeds.
export function createTechWriterTools(deps: AgentDeps, draft: TechWriterDraft): ToolDefinition<any>[] {
  return [writeNoteTool(draft), ...createFindingTools(deps, draft.findings)];
}

function writeNoteTool(draft: TechWriterDraft) {
  return defineTool({
    name: "write_note",
    description: "Write one whole note of the docs vault (frontmatter included): a changed target note or a new note in the target folder. A second call for the same path replaces the first. Applied when the run succeeds.",
    input: {
      path: z.string().min(1).describe("Relative to the vault root, e.g. pvsi/signals/medicaid-recipient-facility.md"),
      content: z.string().min(1).describe("The complete note"),
    },
    handler: async (input) => {
      const problem = notePathProblem(input.path) ?? (hasFrontmatter(input.content) ? null : "a note opens with its frontmatter (see the vault rules)");

      if (problem) {
        return { text: `Not saved: ${problem}`, isError: true };
      }

      const path = normalizeNotePath(input.path);

      draft.edits = [...draft.edits.filter((edit) => edit.path !== path), { path, content: input.content }];

      return { text: `${path} noted (${draft.edits.length} note(s) in this run).` };
    },
  });
}

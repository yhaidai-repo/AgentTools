import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import { normalizeNotePath, notePathProblem } from "./notePaths";

// Pipeline tools of the tech-writer. They only fill the draft; nothing is written until the run succeeds.
export function createTechWriterTools(deps: AgentDeps, draft: TechWriterDraft): ToolDefinition<any>[] {
  return [writeNoteTool(draft), recordFindingTool(draft), ...(deps.listRegister ? [listRegisterTool(deps.listRegister)] : [])];
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
      const problem = notePathProblem(input.path);

      if (problem) {
        return { text: `Not saved: ${problem}`, isError: true };
      }

      const path = normalizeNotePath(input.path);

      draft.edits = [...draft.edits.filter((edit) => edit.path !== path), { path, content: input.content }];

      return { text: `${path} noted (${draft.edits.length} note(s) in this run).` };
    },
  });
}

function recordFindingTool(draft: TechWriterDraft) {
  return defineTool({
    name: "record_finding",
    description: "Report something only a person can settle: an open question (business rule, missing spec, docs vs code) or a known issue (a likely defect). The user reviews it and may submit it to the project's register. Don't put it into a note as a guess.",
    input: {
      type: z.enum(["question", "issue"]),
      project: z.string().min(1).describe("Project key, e.g. pvs or pvsi"),
      title: z.string().min(1).describe("A question for questions, a short defect name for issues"),
      text: z.string().min(1).describe("1-3 lines: what and why it matters, with the symbols involved"),
      default: z.array(z.string()).default([]).describe("Questions: what holds until it is answered"),
      options: z.array(z.string()).default([]).describe("Questions: the possible answers"),
    },
    handler: async (input) => {
      draft.findings.push(input);

      return { text: `Finding ${draft.findings.length} noted for the user's review.` };
    },
  });
}

function listRegisterTool(listRegister: NonNullable<AgentDeps["listRegister"]>) {
  return defineTool({
    name: "list_register",
    description: "List a project's open questions or known issues (id, title, status), so you don't report what is already recorded.",
    input: {
      project: z.string().min(1),
      kind: z.enum(["questions", "issues"]),
    },
    handler: async (input) => {
      const records = await listRegister(input.project, input.kind);
      const lines = records.map((record) => `- ${record.id} (${record.status}): ${record.title}`);

      return { text: lines.join("\n") || "The register has no records." };
    },
  });
}

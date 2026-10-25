import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "./models/AgentDeps";
import type { FindingDraft } from "./techWriter/models/FindingDraft";

// The tools vault agents (tech-writer, vault review) report findings with: collected in memory, items after a successful run.
export function createFindingTools(deps: AgentDeps, findings: FindingDraft[]): ToolDefinition<any>[] {
  return [recordFindingTool(findings), ...(deps.listRegister ? [listRegisterTool(deps.listRegister)] : [])];
}

function recordFindingTool(findings: FindingDraft[]) {
  return defineTool({
    name: "record_finding",
    description: "Report something only a person can settle: an open question (business rule, missing spec, docs vs code) or a known issue (a likely defect). The user reviews it and may submit it to the project's register. Don't put it into a note as a guess.",
    input: {
      type: z.enum(["question", "issue"]),
      project: z.string().min(1).describe("Project key, e.g. shop or crm"),
      title: z.string().min(1).describe("A question for questions, a short defect name for issues"),
      text: z.string().min(1).describe("1-3 lines: what and why it matters, with the symbols involved"),
      default: z.array(z.string()).default([]).describe("Questions: what holds until it is answered"),
      options: z.array(z.string()).default([]).describe("Questions: the possible answers"),
    },
    handler: async (input) => {
      findings.push(input);

      return { text: `Finding ${findings.length} noted for the user's review.` };
    },
    replayOnResume: true,
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

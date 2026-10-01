import { repo, type AdoaDb } from "@adoa/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { RefinementDraft } from "./models/RefinementDraft";

// Pipeline tools of the refinement agent. They only fill the draft; nothing is written until the run succeeds.
export function createRefinementTools(db: AdoaDb, draft: RefinementDraft, pbiMessage: string): ToolDefinition<any>[] {
  return [getPbiTool(pbiMessage), listReposTool(db), writeRefinementTool(draft), createResearchTaskTool(draft), createQuestionTool(draft)];
}

function getPbiTool(pbiMessage: string) {
  return defineTool({
    name: "get_pbi",
    description: "Re-read the PBI note and its Azure DevOps fields (the same content as the first message).",
    input: {},
    handler: async () => ({ text: pbiMessage }),
  });
}

function listReposTool(db: AdoaDb) {
  return defineTool({
    name: "list_repos",
    description: "List the code repositories of the organization: name, Azure DevOps project, summary.",
    input: {},
    handler: async () => {
      const rows = await db.select().from(repo).where(eq(repo.excluded, false));
      const lines = rows.map((row) => `- ${row.name} (project ${row.adoProject})${row.summary ? `: ${row.summary}` : ""}`);

      return { text: lines.join("\n") || "No repositories known." };
    },
  });
}

function writeRefinementTool(draft: RefinementDraft) {
  return defineTool({
    name: "write_refinement",
    description: "Save the refinement of the PBI. Call exactly once; a second call replaces the first.",
    input: {
      summary: z.string().min(1).describe("2-4 plain sentences: what the PBI asks for and why"),
      scope_in: z.array(z.string()).describe("What is in scope"),
      scope_out: z.array(z.string()).describe("What is explicitly out of scope"),
      ac_gaps: z.array(z.object({ gap: z.string(), suggestion: z.string() })).describe("Missing, ambiguous or untestable acceptance criteria, each with a suggested wording"),
      dependencies: z.array(z.string()).describe("Systems, events, data or other PBIs this depends on"),
      repos: z.array(z.object({ name: z.string(), reason: z.string() })).describe("Repos from list_repos the work likely touches"),
      assumptions: z.array(z.string()).describe("Assumptions you made"),
      relevant_docs: z.array(z.object({ path: z.string(), why: z.string() })).describe("Docs (paths as the docs tools show them) research and design should read, and why"),
    },
    handler: async (input) => {
      draft.refinement = {
        summary: input.summary,
        scopeIn: input.scope_in,
        scopeOut: input.scope_out,
        acGaps: input.ac_gaps,
        dependencies: input.dependencies,
        repos: input.repos,
        assumptions: input.assumptions,
        relevantDocs: input.relevant_docs,
      };

      return { text: "Refinement saved." };
    },
  });
}

function createResearchTaskTool(draft: RefinementDraft) {
  return defineTool({
    name: "create_research_task",
    description: "Create a research task for an unknown that reading code or docs can answer. One question per task.",
    input: {
      title: z.string().min(1),
      question: z.string().min(1).describe("The single question to answer"),
      goal: z.string().min(1).describe("Why the answer matters for the implementation plan"),
      repos: z.array(z.string()).describe("Repos to inspect, from list_repos"),
    },
    handler: async (input) => {
      draft.researchTasks.push(input);

      return { text: `Research task ${draft.researchTasks.length} noted.` };
    },
  });
}

function createQuestionTool(draft: RefinementDraft) {
  return defineTool({
    name: "create_question",
    description: "Ask a person something only a person can answer: a business rule, a trade-off, a missing spec.",
    input: {
      question: z.string().min(1),
      why: z.string().min(1).describe("Why the answer matters"),
      options: z.array(z.string()).describe("Possible answers, if you can name them"),
    },
    handler: async (input) => {
      draft.questions.push(input);

      return { text: `Question ${draft.questions.length} noted.` };
    },
  });
}

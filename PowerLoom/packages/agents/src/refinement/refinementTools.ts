import { MAX_PBI_SKILLS, enabledRepos, pbiSkillProblems } from "@powerloom/core";
import { relevantPageProblems, relevantPagesInput } from "../relevantPages";
import type { PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { DuplicateGuard } from "../DuplicateGuard";
import { estimateInput } from "./estimateInput";
import type { RefinementDraft } from "./models/RefinementDraft";

// Pipeline tools of the refinement agent. They only fill the draft; nothing is written until the run succeeds.
// `availableSkills`: the skills it may recommend for the PBI (what list_skills shows).
// list_repos, which write_refinement's repos come from, is one of the shared tools every agent has.
export function createRefinementTools(draft: RefinementDraft, pbiMessage: string, availableSkills: string[], guard: DuplicateGuard): ToolDefinition<any>[] {
  return [getPbiTool(pbiMessage), writeRefinementTool(draft, availableSkills), createResearchTaskTool(draft, guard), createQuestionTool(draft, guard)];
}

function getPbiTool(pbiMessage: string) {
  return defineTool({
    name: "get_pbi",
    description: "Re-read the PBI note and its Azure DevOps fields (the same content as the first message).",
    input: {},
    handler: async () => ({ text: pbiMessage }),
  });
}

export function listReposTool(db: PowerLoomDb, vault: string) {
  return defineTool({
    name: "list_repos",
    description: "List the code repositories configured for this vault: name, Azure DevOps project (or local), summary.",
    input: {},
    handler: async () => {
      const rows = await enabledRepos(db, vault);
      const lines = rows.map((row) => `- ${row.name} (${row.kind === "local" ? "local" : `project ${row.adoProject}`})${row.summary ? `: ${row.summary}` : ""}`);

      return { text: lines.join("\n") || "No repositories known." };
    },
  });
}

function writeRefinementTool(draft: RefinementDraft, availableSkills: string[]) {
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
      skills: z.array(z.object({ name: z.string(), reason: z.string() })).default([]).describe(`Up to ${MAX_PBI_SKILLS} skills from list_skills that help the later agents on this PBI, each with why; none is fine`),
      relevant_pages: relevantPagesInput,
      estimate: estimateInput,
    },
    handler: async (input) => {
      const problems = [...pbiSkillProblems(input.skills.map((skill) => skill.name), availableSkills), ...relevantPageProblems(input.relevant_pages)];

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.refinement = {
        summary: input.summary,
        scopeIn: input.scope_in,
        scopeOut: input.scope_out,
        acGaps: input.ac_gaps,
        dependencies: input.dependencies,
        repos: input.repos,
        assumptions: input.assumptions,
        relevantDocs: input.relevant_docs,
        skills: input.skills,
        estimate: input.estimate,
      };
      draft.pages = input.relevant_pages;

      return { text: "Refinement saved." };
    },
  });
}

function createResearchTaskTool(draft: RefinementDraft, guard: DuplicateGuard) {
  return defineTool({
    name: "create_research_task",
    description: "Create a research task for an unknown that reading code or docs can answer. One question per task.",
    input: {
      title: z.string().min(1),
      question: z.string().min(1).describe("The single question to answer"),
      goal: z.string().min(1).describe("Why the answer matters for the implementation plan"),
    },
    handler: async (input) => {
      const duplicate = guard.check("research", input.question);

      if (duplicate) {
        return { text: duplicate, isError: true };
      }

      draft.researchTasks.push(input);
      guard.remember("research", `research task ${draft.researchTasks.length}`, input.question);

      return { text: `Research task ${draft.researchTasks.length} noted.` };
    },
  });
}

function createQuestionTool(draft: RefinementDraft, guard: DuplicateGuard) {
  return defineTool({
    name: "create_question",
    description: "Ask a person something only a person can answer: a business rule, a trade-off, a missing spec.",
    input: {
      question: z.string().min(1),
      why: z.string().min(1).describe("Why the answer matters"),
      options: z.array(z.string()).describe("Possible answers, if you can name them"),
    },
    handler: async (input) => {
      const duplicate = guard.check("question", input.question);

      if (duplicate) {
        return { text: duplicate, isError: true };
      }

      draft.questions.push(input);
      guard.remember("question", `question ${draft.questions.length}`, input.question);

      return { text: `Question ${draft.questions.length} noted.` };
    },
  });
}

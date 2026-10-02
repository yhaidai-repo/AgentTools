import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { relevantPageProblems, relevantPagesInput } from "../relevantPages";
import { z } from "zod";
import type { DuplicateGuard } from "../DuplicateGuard";
import type { ResearchDraft } from "./models/ResearchDraft";

// Pipeline tools of the research agent. They only fill the draft; nothing is written until the run succeeds.
export function createResearchTools(draft: ResearchDraft, depth: number, maxDepth: number, guard: DuplicateGuard): ToolDefinition<any>[] {
  return [writeResultTool(draft), followUpTool(draft, depth, maxDepth, guard), humanTaskTool(draft, guard), questionTool(draft, guard)];
}

function writeResultTool(draft: ResearchDraft) {
  return defineTool({
    name: "write_research_result",
    description: "Save the answer to the research task. Call exactly once; a second call replaces the first.",
    input: {
      conclusion: z.string().min(1).describe("The answer to the task's question, in 2-5 sentences"),
      findings: z.array(z.string()).describe("What you found, one fact per item"),
      evidence: z.array(z.object({ location: z.string(), note: z.string() })).describe("Where each fact comes from: '<repo>/<path>:<line>' or a doc path, plus a symbol if any"),
      confidence: z.enum(["high", "medium", "low"]),
      relevant_docs: z.array(z.object({ path: z.string(), why: z.string() })).describe("Docs the design agent should read"),
      code_refs: z.array(z.object({ location: z.string(), why: z.string() })).describe("Code locations the design agent should start from"),
      relevant_pages: relevantPagesInput,
    },
    handler: async (input) => {
      const problems = relevantPageProblems(input.relevant_pages);

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.pages = input.relevant_pages;
      draft.result = {
        conclusion: input.conclusion,
        findings: input.findings,
        evidence: input.evidence,
        confidence: input.confidence,
        relevantDocs: input.relevant_docs,
        codeRefs: input.code_refs,
      };

      return { text: "Research result saved." };
    },
  });
}

function followUpTool(draft: ResearchDraft, depth: number, maxDepth: number, guard: DuplicateGuard) {
  return defineTool({
    name: "create_research_task",
    description: `Create a follow-up research task for a new unknown this task can't cover. Allowed up to depth ${maxDepth}; this task is depth ${depth}.`,
    input: {
      title: z.string().min(1),
      question: z.string().min(1),
      goal: z.string().min(1),
      repos: z.array(z.string()),
    },
    handler: async (input) => {
      if (depth >= maxDepth) {
        return { text: `Not allowed: depth limit ${maxDepth} reached. Ask a question or note it in the result instead.`, isError: true };
      }

      const duplicate = guard.check("research", input.question);

      if (duplicate) {
        return { text: duplicate, isError: true };
      }

      draft.followUps.push(input);
      guard.remember("research", `follow-up ${draft.followUps.length}`, input.question);

      return { text: `Follow-up research task ${draft.followUps.length} noted.` };
    },
  });
}

function humanTaskTool(draft: ResearchDraft, guard: DuplicateGuard) {
  return defineTool({
    name: "create_human_task",
    description: "Create a task for a person: something that needs access, an action or a decision you can't make.",
    input: { title: z.string().min(1), description: z.string().min(1) },
    handler: async (input) => {
      const duplicate = guard.check("human", input.description);

      if (duplicate) {
        return { text: duplicate, isError: true };
      }

      draft.humanTasks.push(input);
      guard.remember("human", `human task ${draft.humanTasks.length}`, input.description);

      return { text: `Human task ${draft.humanTasks.length} noted.` };
    },
  });
}

function questionTool(draft: ResearchDraft, guard: DuplicateGuard) {
  return defineTool({
    name: "create_question",
    description: "Ask a person something only a person can answer: a business rule, a trade-off, a missing spec.",
    input: {
      question: z.string().min(1),
      why: z.string().min(1),
      options: z.array(z.string()),
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

import { renderHumanTaskBody } from "@adoa/core";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { createHumanTaskTool } from "../humanTasks/humanTaskTool";
import type { DuplicateGuard } from "../DuplicateGuard";
import { relevantPageProblems, relevantPagesInput } from "../relevantPages";
import { gapItemKind } from "./gapItems";
import type { DesignDraft } from "./models/DesignDraft";
import type { GapItem } from "./models/GapItem";

// Pipeline tools of the design agent. They only fill the draft; nothing is written until the run succeeds. Questions and
// tasks go to the user only: design has the same code and docs as research (user decision 2026-10-02).
export function createDesignTools(draft: DesignDraft, guard: DuplicateGuard): ToolDefinition<any>[] {
  return [writeDesignTool(draft), questionTool(draft, guard), taskTool(draft, guard)];
}

function writeDesignTool(draft: DesignDraft) {
  return defineTool({
    name: "write_design",
    description: "Save the implementation design. Call exactly once when you can design; a second call replaces the first. Don't call it when gaps stop you: create the questions or tasks for the user instead.",
    input: {
      approach: z.string().min(1).describe("The solution and why this one, in 3-6 sentences"),
      alternatives: z.array(z.object({
        option: z.string().min(1),
        pros: z.array(z.string()),
        cons: z.array(z.string()),
        why_not: z.string().min(1),
      })).default([]).describe("Other solutions worth weighing, when relevant; none is fine for an obvious change"),
      plan: z.array(z.object({
        step: z.string().min(1).describe("Short title, without a number (steps are numbered by their order)"),
        repo: z.string().min(1),
        locations: z.array(z.string()).describe("Files and symbols, e.g. 'src/Orders/OrderService.cs: OrderService.Cancel'"),
        change: z.string().min(1),
        agent_doable: z.boolean().describe("Whether an agent can implement this step without a person"),
      })).min(1).describe("Ordered implementation steps"),
      risks: z.array(z.object({ risk: z.string().min(1), impact: z.enum(["low", "medium", "high"]), mitigation: z.string().min(1) })),
      tests: z.array(z.object({ kind: z.enum(["unit", "integration", "manual"]), case: z.string().min(1).describe("One line: given / when / then") })).min(1),
      estimate: z.object({
        human_hours: z.number().positive().describe("A developer implementing the plan without an agent"),
        agent_hours: z.number().positive().describe("An agent implementing the plan"),
        complexity: z.number().int().min(1).max(5),
        confidence: z.enum(["high", "medium", "low"]),
        basis: z.string().min(1).describe("What drives the numbers"),
      }),
      assumptions: z.array(z.string()).describe("Every guess the design rests on"),
      relevant_pages: relevantPagesInput,
    },
    handler: async (input) => {
      const problems = relevantPageProblems(input.relevant_pages);

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.pages = input.relevant_pages;
      draft.design = {
        approach: input.approach,
        alternatives: input.alternatives.map((item) => ({ option: item.option, pros: item.pros, cons: item.cons, whyNot: item.why_not })),
        plan: input.plan.map((step) => ({ step: step.step, repo: step.repo, locations: step.locations, change: step.change, agentDoable: step.agent_doable })),
        risks: input.risks,
        tests: input.tests,
        estimate: {
          humanHours: input.estimate.human_hours,
          agentHours: input.estimate.agent_hours,
          complexity: input.estimate.complexity,
          confidence: input.estimate.confidence,
          basis: input.estimate.basis,
        },
        assumptions: input.assumptions,
      };

      return { text: "Design saved." };
    },
  });
}

function questionTool(draft: DesignDraft, guard: DuplicateGuard) {
  return defineTool({
    name: "create_question",
    description: "Ask the user something the design depends on that only a person can answer: a business rule, trade-off, missing spec, or a fact outside the code and docs.",
    input: { question: z.string().min(1), why: z.string().min(1), options: z.array(z.string()).default([]) },
    handler: async (input) => noteGap(draft, guard, { kind: "question", title: input.question, text: input.question, why: input.why, options: input.options, humanTask: null }),
  });
}

function taskTool(draft: DesignDraft, guard: DuplicateGuard) {
  return createHumanTaskTool(
    "create_task",
    "Create a task for the user that the design needs done: access, an action, a decision, or finding out something outside the code and docs.",
    (spec) => noteGap(draft, guard, { kind: "task", title: spec.title, text: renderHumanTaskBody(spec.data), why: spec.data.why, options: [], humanTask: spec.data }),
  );
}

function noteGap(draft: DesignDraft, guard: DuplicateGuard, item: GapItem): { text: string; isError?: boolean } {
  const kind = gapItemKind(item);
  const duplicate = guard.check(kind, item.text);

  if (duplicate) {
    return { text: duplicate, isError: true };
  }

  draft.gaps.push(item);
  guard.remember(kind, `${item.kind} ${draft.gaps.length}`, item.text);

  return { text: `${item.kind} ${draft.gaps.length} for the user noted.` };
}

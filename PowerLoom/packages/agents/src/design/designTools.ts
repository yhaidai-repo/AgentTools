import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { relevantPageProblems, relevantPagesInput } from "../relevantPages";
import type { DesignDraft } from "./models/DesignDraft";

// Pipeline tools of the design agent. They only fill the draft; nothing is written until the run succeeds. What stops a
// design goes to the user with the shared hand_off (user decision 2026-10-28; design has the same code and docs as
// research, so it looks things up itself).
export function createDesignTools(draft: DesignDraft): ToolDefinition<any>[] {
  return [writeDesignTool(draft)];
}

function writeDesignTool(draft: DesignDraft) {
  return defineTool({
    name: "write_design",
    description: "Save or replace the implementation design: call it when you can design; another call replaces the earlier one. Don't call it when gaps stop you: hand_off the questions or tasks to a person instead.",
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
        assumptions: input.assumptions,
      };

      return { text: "Design saved." };
    },
    replayOnResume: true,
  });
}

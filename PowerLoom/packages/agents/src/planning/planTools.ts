import { PLAN_CHECK_VERDICTS } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { PlanDraft } from "./models/PlanDraft";
import type { PlanningFolder } from "./models/PlanningFolder";
import { readPlan } from "./readPlan";

// The planning agent's output tool. The plan itself is read from the worktree's .planning/ (what GSD wrote), so the
// stored plan is the one implementation will execute; the agent adds only what no file holds. Nothing is written until
// the run succeeds.
export function createPlanTools(draft: PlanDraft, folder: () => PlanningFolder | null): ToolDefinition<any>[] {
  return [writePlanTool(draft, folder)];
}

function writePlanTool(draft: PlanDraft, folder: () => PlanningFolder | null) {
  return defineTool({
    name: "write_plan",
    description: "Save the PBI's plan once /gsd-plan-phase has planned every roadmap phase: the plans, waves, tasks, decisions and requirements coverage are read from .planning/, you add the summary, the plan checker's last verdict and the style defaults you took. Another call replaces the earlier one. Don't call it while a fact the plan depends on is open: hand_off the questions instead.",
    input: {
      summary: z.string().min(1).describe("What the plan does and why this way, in 3-6 sentences, for the person who reviews it"),
      checker_verdict: z.enum(PLAN_CHECK_VERDICTS).describe("The last gsd-plan-checker return: passed (## VERIFICATION PASSED), issues (## ISSUES FOUND), not-run"),
      checker_issues: z.array(z.string()).default([]).describe("The issues it still lists, one line each; empty when it passed"),
      assumptions: z.array(z.string()).default([]).describe("Every style-level default you took instead of asking, and each [auto] choice you kept without evidence; facts the plan depends on are questions, never assumptions"),
    },
    handler: async (input) => {
      const planning = folder();

      if (!planning) {
        return { text: "Not saved: this run has no worktree with a .planning/ folder.", isError: true };
      }

      const reading = await readPlan(planning, { summary: input.summary, checker: { verdict: input.checker_verdict, issues: input.checker_issues }, assumptions: input.assumptions });

      if (!reading.ok) {
        return { text: `Not saved: ${reading.problem}.`, isError: true };
      }

      draft.plan = { content: reading.content, inspect: reading.inspect };

      return { text: savedText(draft) };
    },
    replayOnResume: true,
  });
}

function savedText(draft: PlanDraft): string {
  const content = draft.plan!.content;
  const uncovered = content.requirements.filter((requirement) => requirement.plans.length === 0).map((requirement) => requirement.id);
  const coverage = uncovered.length > 0 ? ` Not covered by any plan: ${uncovered.join(", ")}.` : "";

  return `Plan saved: ${content.plans.length} plans, ${content.decisions.length} decisions, ${content.requirements.length} requirements.${coverage}`;
}

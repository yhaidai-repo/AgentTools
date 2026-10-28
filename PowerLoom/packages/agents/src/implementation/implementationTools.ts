import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import { uatLine } from "./handOverPackage";
import type { BuildDraft } from "./models/BuildDraft";
import type { BuildTarget } from "./models/BuildTarget";
import { readBuild } from "./readBuild";

// The implementation agent's output tool. The build is read from the worktree's .planning/ and git (what GSD and its
// executors left), so the stored build is what the person reviews; the agent adds only what no file holds. Nothing is
// written until the run succeeds. The target is null for a run without a worktree (no approval, or no repo).
export function createImplementationTools(draft: BuildDraft, target: () => Promise<BuildTarget | null>): ToolDefinition<any>[] {
  return [writeImplementationTool(draft, target)];
}

function writeImplementationTool(draft: BuildDraft, target: () => Promise<BuildTarget | null>) {
  return defineTool({
    name: "write_implementation",
    description: "Save the PBI's implementation once execute-phase and verify-work ran for every phase: each plan's progress, the commits, deviations, the verification matrix and the open UAT items are read from .planning/ and git; you add the summary, the pull request's title, the verdict and the checkpoints you settled. Another call replaces the earlier one. Then hand it over to a person.",
    input: {
      summary: z.string().min(1).describe("What the branch changes and why, in 3-6 sentences, for the person who reviews and pushes it"),
      pr_title: z.string().min(1).describe("The pull request's title: what it does, in the repo's style"),
      verdict: z.string().min(1).describe("The verification in one line, per phase: passed, gaps_found or human_needed with the score, and the build and test commands' last result"),
      checkpoints: z.array(z.object({
        plan: z.string().describe("The plan id, e.g. 01-02"),
        text: z.string().describe("What the executor stopped for (## CHECKPOINT REACHED)"),
        resolution: z.string().describe("How you settled it, or 'open: for the person' when only a person can"),
      })).default([]).describe("Every checkpoint an executor stopped at; empty when none"),
    },
    handler: async (input) => {
      const run = await target();

      if (!run) {
        return { text: "Not saved: this run has no worktree to build in.", isError: true };
      }

      const reading = await readBuild(run.source, run.place, { summary: input.summary, prTitle: input.pr_title, verdict: input.verdict, checkpoints: input.checkpoints });

      if (!reading.ok) {
        return { text: `Not saved: ${reading.problem}.`, isError: true };
      }

      draft.build = { content: reading.content, inspect: reading.inspect };

      return { text: savedText(draft) };
    },
    replayOnResume: true,
  });
}

function savedText(draft: BuildDraft): string {
  const build = draft.build!.content;
  const done = build.plans.filter((plan) => plan.status === "done").length;
  const uat = build.uat.map((item) => `- ${uatLine(item)}`);

  return [
    `Implementation saved: ${done} of ${build.plans.length} plans done, ${build.commits.length} commits on ${build.branch}, hand-over ${build.handOver.state}.`,
    "Hand it over now: hand_off to person, item task, intent review, gate none, titled to review the branch, push it and open the pull request; PowerLoom adds the branch, the worktree and the pull request description to the task. Steps: review the commits in the worktree; one step per open UAT item below; push the branch and open the pull request.",
    ...(uat.length > 0 ? ["Open UAT items:", ...uat] : ["No open UAT items."]),
  ].join("\n");
}

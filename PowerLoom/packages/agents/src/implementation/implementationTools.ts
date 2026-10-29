import { defineTool, type ToolDefinition, type ToolResult } from "@agenttools/runtime";
import { z } from "zod";
import type { BuildContent } from "@powerloom/db";
import { buildChecksOf } from "./buildChecks";
import { BUILD_FIRST, EXECUTE_FIRST, checksText, donePlans, restoreFirst, unbuiltProblem, withChecks } from "./buildGate";
import { uatLine } from "./handOverPackage";
import type { BuildDraft } from "./models/BuildDraft";
import type { BuildTarget } from "./models/BuildTarget";
import type { ReportedBuild } from "./models/ReportedBuild";
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
    description: "Save the PBI's implementation once execute-phase and verify-work ran for every phase: each plan's progress, the commits, deviations, the verification matrix and the open UAT items are read from .planning/ and git; you add the summary, the pull request's title, the verdict and the checkpoints you settled. PowerLoom records the last build and test this run's sandbox ran and saves nothing while the repo's build command has not passed, its test command has not run, or no plan is done. Another call replaces the earlier one. Then hand it over to a person.",
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

      return saveBuild(draft, run, { summary: input.summary, prTitle: input.pr_title, verdict: input.verdict, checkpoints: input.checkpoints });
    },
    replayOnResume: true,
  });
}

// PowerLoom, not the agent, says whether the branch was built: a configured build must have passed and a configured
// test must have run in this run's sandbox, and at least one plan must be done by GSD, or nothing is saved.
async function saveBuild(draft: BuildDraft, run: BuildTarget, reported: ReportedBuild): Promise<ToolResult> {
  const checks = buildChecksOf(run.buildLog.runs, run.place.commands);
  const unbuilt = unbuiltProblem(checks, run.place.commands);

  if (unbuilt) {
    return { text: [`Not saved: ${unbuilt}.`, ...restoreFirst(run.buildLog, run.place.repo), BUILD_FIRST].join("\n"), isError: true };
  }

  const reading = await readBuild(run.source, run.place, reported);

  if (!reading.ok) {
    return { text: `Not saved: ${reading.problem}.`, isError: true };
  }

  const content = withChecks(reading.content, checks);

  if (donePlans(content) === 0) {
    return { text: `Not saved: 0 of ${content.plans.length} plans are done.\n${EXECUTE_FIRST}`, isError: true };
  }

  draft.build = { content, inspect: reading.inspect };

  return { text: savedText(content) };
}

function savedText(build: BuildContent): string {
  const uat = build.uat.map((item) => `- ${uatLine(item)}`);

  return [
    `Implementation saved: ${donePlans(build)} of ${build.plans.length} plans done, ${build.commits.length} commits on ${build.branch}, hand-over ${build.handOver.state}.`,
    `Build: ${checksText(build)}.`,
    "Hand it over now: hand_off to person, item task, intent review, gate none, titled to review the branch, push it and open the pull request; PowerLoom adds the branch, the worktree and the pull request description to the task. Steps: review the commits in the worktree; one step per open UAT item below; push the branch and open the pull request.",
    ...(uat.length > 0 ? ["Open UAT items:", ...uat] : ["No open UAT items."]),
  ].join("\n");
}

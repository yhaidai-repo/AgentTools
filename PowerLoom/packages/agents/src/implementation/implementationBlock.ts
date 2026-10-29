import type { PreparedImplementation } from "./models/PreparedImplementation";
import type { ReviewOutcome } from "./models/ReviewOutcome";
import { WORKTREE_SHELL_CONTRACT } from "./worktreeShellContract";

// The task's type for planning: a planning task takes the review's changes back.
export const PLANNING_TASK_TYPE = "design";

// What the first message says the run does, decided before it starts: build the approved plan in its worktree, hand the
// changes back to planning, or stop.
export function implementationBlock(prepared: PreparedImplementation): string {
  const { outcome } = prepared;

  if (outcome.kind === "replan") {
    return replanBlock(outcome);
  }

  if (outcome.kind === "blocked") {
    return `<implementation outcome="blocked">\n${outcome.reason}\nDon't build. End with write_result, status blocked, naming this reason.\n</implementation>`;
  }

  return approvedBlock(prepared, outcome.reviewId, outcome.planVersion);
}

function replanBlock(outcome: Extract<ReviewOutcome, { kind: "replan" }>): string {
  return [
    `<implementation outcome="replan">`,
    `Back to planning: ${outcome.reason}. Don't build.`,
    `hand_off to \`${PLANNING_TASK_TYPE}\` with intent continue: the package body carries the changes below as they were written, and refers to ${outcome.reviewId ?? "the PBI"} and the plan (PBI-<id>:plan). Then write_result, status complete.`,
    "Changes:",
    outcome.corrections,
    "</implementation>",
  ].join("\n");
}

function approvedBlock(prepared: PreparedImplementation, reviewId: string, planVersion: number): string {
  const { workspace, commands } = prepared;

  return [
    `<implementation outcome="approved">`,
    `${reviewId} approved plan v${planVersion} (PBI-<id>:plan): build it.`,
    `Repo: ${workspace?.repo.name ?? "-"}`,
    `Branch: ${workspace?.branch ?? "-"} (from ${workspace?.baseBranch ?? "-"}); commit locally only, never push.`,
    `Build command: ${commands.build ? `\`${commands.build}\`` : "none configured"}`,
    `Test command: ${commands.test ? `\`${commands.test}\`` : "none configured"}`,
    "Your working folder is this branch's worktree, with the plan in .planning/ and .planning/config.json set for this run.",
    WORKTREE_SHELL_CONTRACT,
    "</implementation>",
  ].join("\n");
}

import type { BuildContent, OpenUatItem } from "@powerloom/db";

// The pull request a person opens from the branch (user decision 2026-10-29: the agent never pushes): the summary, the
// changes by plan, the verification verdict, the open UAT items and the deviations.
export function pullRequestBody(build: BuildContent): string {
  return [
    "## Summary",
    build.summary,
    "## Changes by plan",
    ...build.plans.map((plan) => `- **${plan.id}** ${plan.objective}${plan.oneLiner ? `: ${plan.oneLiner}` : ""} (${plan.status}, ${plan.tasksDone}/${plan.tasksTotal} tasks)`),
    "## Verification",
    build.handOver.verdict,
    ...build.verification.map((phase) => `- Phase ${phase.phase}: ${phase.status}${phase.score ? ` (${phase.score})` : ""}`),
    ...listSection("## Open UAT items", build.uat.map((item) => `- [ ] ${uatLine(item)}`)),
    ...listSection("## Deviations from the plan", build.deviations.map((deviation) => `- ${deviation.plan}: ${deviation.text}`)),
  ].join("\n\n");
}

// What PowerLoom puts at the top of the hand-over task: where the branch and its worktree are, the state, and the pull
// request ready to paste.
export function handOverBlock(build: BuildContent): string {
  return [
    `**Branch:** \`${build.branch}\` in ${build.repo}, from \`${build.baseBranch}\`, head \`${build.headSha ?? "-"}\`, ${build.commits.length} local commits; nothing is pushed.`,
    `**Worktree:** \`${build.worktree}\` (kept for this task until it closes).`,
    `**Hand-over:** ${build.handOver.state}: ${build.handOver.verdict}`,
    "### Pull request",
    `**Title:** ${build.handOver.prTitle}`,
    pullRequestBody(build),
  ].join("\n\n");
}

// The open UAT tests, each a step of the hand-over task.
export function uatLine(item: OpenUatItem): string {
  return `Phase ${item.phase}, test ${item.test}: ${item.name} (${item.result}${item.reason ? `: ${item.reason}` : ""})`;
}

function listSection(heading: string, lines: string[]): string[] {
  return lines.length > 0 ? [heading, lines.join("\n")] : [];
}

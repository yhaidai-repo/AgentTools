import { WORKTREE_SHELL_RULE, type GsdSeedFile } from "@agenttools/runtime";

// What a planning or implementation run's worktree shell runs, told up front so the agent and GSD's sub-agents don't
// learn it from refusals (run 4414, 2026-10-29). The rule itself is the runtime's, the words every refusal repeats.
export const WORKTREE_SHELL_CONTRACT = [
  "## The worktree shell",
  WORKTREE_SHELL_RULE,
  "- Give a listing command its folder as an argument (`grep -rn Total src`, `ls src/app`); `cd` goes only in front of a build or test.",
  "- Every part of a `&&`, `;` or `|` chain must be allowed on its own: no variable assignments, no `$(…)` (a commit message as `\"$(cat <<'EOF' … EOF)\"` is the one exception), no output written to a file.",
  "- Keep paths relative and inside the worktree: no absolute paths outside it, no `..` out of it, no `~`.",
  "- Commit locally with git; pushing and pull requests are a person's step.",
  "Why: the shell runs on the runner, which holds the run's credentials and has no build toolchains.",
].join("\n");

// GSD 1.19.0 hands a skill to a sub-agent through .planning/config.json's agent_skills: the orchestrator injects an
// <agent_skills> block naming the SKILL.md into the agent's prompt, or the agent loads it itself. GSD skips a skill path
// outside the project, hence one under .planning/ (the seed's files land there).
const SKILL_FOLDER = "skills/powerloom-worktree-shell";
const GSD_AGENTS = [
  "gsd-advisor-researcher", "gsd-assumptions-analyzer", "gsd-code-fixer", "gsd-code-reviewer", "gsd-codebase-mapper", "gsd-debugger",
  "gsd-doc-writer", "gsd-eval-auditor", "gsd-executor", "gsd-integration-checker", "gsd-nyquist-auditor", "gsd-pattern-mapper",
  "gsd-phase-researcher", "gsd-plan-checker", "gsd-planner", "gsd-project-researcher", "gsd-research-synthesizer", "gsd-roadmapper",
  "gsd-security-auditor", "gsd-ui-auditor", "gsd-ui-checker", "gsd-ui-researcher", "gsd-verifier",
];

export const WORKTREE_SHELL_SKILL_FILE: GsdSeedFile = {
  path: `${SKILL_FOLDER}/SKILL.md`,
  content: `---\nname: powerloom-worktree-shell\ndescription: What the worktree's shell runs, what goes to the sandbox and what is refused.\n---\n\n${WORKTREE_SHELL_CONTRACT}\n`,
};

/** The agent_skills entry of .planning/config.json that gives every GSD sub-agent the worktree shell contract. */
export function worktreeShellSkills(): Record<string, string[]> {
  return Object.fromEntries(GSD_AGENTS.map((agent) => [agent, [`.planning/${SKILL_FOLDER}`]]));
}

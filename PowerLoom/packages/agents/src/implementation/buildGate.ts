import type { BuildChecks, BuildCommands, BuildContent } from "@powerloom/db";
import type { RunBuildLog } from "../sandbox/models/RunBuildLog";
import { checkLine, hasPassed } from "./buildChecks";

// What the agent does when write_implementation finds no successful build (pilot runs 4464, 4470, 4486: a restore
// obstacle, or a belief carried over from an earlier conversation, made the agent skip execute and verify, commit by
// hand and hand the branch over unbuilt).
const BLOCKER_RULE = "A restore or sandbox failure the code can't fix (a feed, the proxy, a missing package) is a blocker: don't hand the branch over; end with write_result, status blocked, quoting the exact error. What an earlier conversation said about a feed or the sandbox is no reason: run it again in this run.";

export const BUILD_FIRST = `Run the build command in Bash (it runs in the run's sandbox on a fresh copy of the worktree) or with run_command after sandbox_sync; fix what fails in the worktree, commit, and call write_implementation again. ${BLOCKER_RULE}`;

export const EXECUTE_FIRST = `Run Skill gsd-execute-phase for each phase with plans not done (its executors write each plan's SUMMARY.md); files edited by hand don't make a plan done. ${BLOCKER_RULE}`;

/** The restore the run skipped (run 4491 built with --no-restore once and called the repo unbuildable). */
export function restoreFirst(log: RunBuildLog, repo: string): string[] {
  const isRestored = log.restores.some((restore) => restore.repo === repo);

  return isRestored ? [] : [`No sandbox_restore of ${repo} ran in this run: restore first (sandbox_restore, with the solution or project as target when the repo's root has none), then build. Missing packages without a restore are no reason to stop.`];
}

export function donePlans(build: BuildContent): number {
  return build.plans.filter((plan) => plan.status === "done").length;
}

/** Why the build can't be saved yet: a configured build that never passed in this run, or a configured test never run. */
export function unbuiltProblem(checks: BuildChecks, commands: BuildCommands): string | null {
  if (commands.build && !checks.build) {
    return `no build ran in this run's sandbox (the repo's build command: \`${commands.build}\`)`;
  }

  if (commands.build && !hasPassed(checks.build)) {
    return `the last build did not pass: ${checkLine(checks.build!)}`;
  }

  if (commands.test && !checks.test) {
    return `no test ran in this run's sandbox (the repo's test command: \`${commands.test}\`)`;
  }

  return null;
}

/** The build with the run's checks; a failing test leaves gaps for the person, whatever the verifier said. */
export function withChecks(build: BuildContent, checks: BuildChecks): BuildContent {
  const isTestFailing = checks.test !== null && !hasPassed(checks.test);
  const state = isTestFailing ? "gaps" : build.handOver.state;

  return { ...build, checks, handOver: { ...build.handOver, state } };
}

/** Why a saved build can't close its task: no plan done, or no passing build while the repo has a build command. */
export function settlementBlocker(build: BuildContent): string | null {
  if (donePlans(build) === 0) {
    return `The implementation was saved with 0 of ${build.plans.length} plans done: GSD's execute-phase finished no plan, so the branch is not handed over as built. Check the run's events, then Re-run.`;
  }

  if (build.commands.build && !hasPassed(build.checks?.build)) {
    return `The implementation was saved without a passing build of \`${build.commands.build}\` in the run's sandbox. Check the run's events, then Re-run.`;
  }

  return null;
}

/** The build and test as the person and the agent see them, or the repo command that's missing. */
export function checksText(build: BuildContent): string {
  const { commands, checks } = build;

  if (!commands.build) {
    return `not built: ${build.repo} has no build command (set it under Settings → Repositories, or with repo_saveCommands)${testText(commands, checks)}`;
  }

  return `${checks?.build ? checkLine(checks.build) : "no build ran"}${testText(commands, checks)}`;
}

function testText(commands: BuildCommands, checks: BuildChecks | undefined): string {
  if (checks?.test) {
    return `; test ${checkLine(checks.test)}`;
  }

  return commands.test ? "; no test ran" : "; no test command configured";
}

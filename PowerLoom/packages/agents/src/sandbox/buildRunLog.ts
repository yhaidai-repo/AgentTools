import type { CommandResult } from "@powerloom/sandbox";
import type { RunBuildLog } from "./models/RunBuildLog";

// The shell's code for a command killed by `timeout`; a timed-out build counts as failed.
const TIMED_OUT_EXIT_CODE = 124;
const PROBLEM_CHARS = 600;

/** Notes a build or test the sandbox ran (or couldn't run) in the run's build log, when the run keeps one. */
export function recordBuildRun(log: RunBuildLog | null | undefined, command: string, exitCode: number | null, problem: string | null): void {
  if (!log) {
    return;
  }

  log.runs.push({ command, exitCode, problem: problem ? problem.slice(0, PROBLEM_CHARS) : null, at: new Date().toISOString() });
}

/** The exit code a finished sandbox command counts with: a timeout or a missing code is a failure. */
export function exitCodeOf(result: CommandResult): number {
  return result.timedOut || result.exitCode === null ? TIMED_OUT_EXIT_CODE : result.exitCode;
}

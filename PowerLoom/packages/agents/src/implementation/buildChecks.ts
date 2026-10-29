import { commandSegments } from "@agenttools/runtime";
import type { BuildCheck, BuildChecks, BuildCommands } from "@powerloom/db";
import { startsWithCommand } from "../sandbox/buildRouting";
import type { SandboxBuildRun } from "../sandbox/models/SandboxBuildRun";

// Besides the repo's configured commands, the usual .NET and npm builds and tests count (the ones the shell routes).
const USUAL_BUILDS = /^(dotnet\s+build|npm\s+run\s+build)(\s|$)/i;
const USUAL_TESTS = /^(dotnet\s+test|npm\s+(test|t|run\s+test))(\s|$)/i;

/** The run's last build and last test as its sandbox ran them; the last one counts, since code may have changed since. */
export function buildChecksOf(runs: SandboxBuildRun[], commands: BuildCommands): BuildChecks {
  return {
    build: lastCheck(runs, (command) => runsCommand(command, commands.build, USUAL_BUILDS)),
    test: lastCheck(runs, (command) => runsCommand(command, commands.test, USUAL_TESTS)),
  };
}

export function hasPassed(check: BuildCheck | null | undefined): boolean {
  return check?.exitCode === 0;
}

/** One check in a line: the command and how it ended. */
export function checkLine(check: BuildCheck): string {
  if (check.exitCode === null) {
    return `\`${check.command}\` could not run in the sandbox: ${check.problem ?? "no reason given"}`;
  }

  const restore = check.problem ? ` (${check.problem})` : "";

  return `\`${check.command}\` ${check.exitCode === 0 ? "passed" : `failed with exit code ${check.exitCode}`}${restore}`;
}

function lastCheck(runs: SandboxBuildRun[], isKind: (command: string) => boolean): BuildCheck | null {
  const run = [...runs].reverse().find((entry) => isKind(entry.command));

  return run ? { command: run.command, exitCode: run.exitCode, at: run.at, problem: run.problem } : null;
}

function runsCommand(command: string, configured: string | null, usual: RegExp): boolean {
  const isConfigured = (part: string) => configured !== null && startsWithCommand(part, configured);

  return isConfigured(command) || commandSegments(command).some((segment) => usual.test(segment) || isConfigured(segment));
}

import { commandSegments } from "@agenttools/runtime";

// The builds and tests the run's sandbox takes from the worktree's shell (user decision 2026-10-29: GSD's executors
// and verifier build and test there too, with no tools of their own): the vault's configured commands, and the usual
// .NET and npm ones. The rest of the shell's refusals stay.
const BUILD_COMMANDS = [/^dotnet\s+(build|test|restore)(\s|$)/i, /^npm\s+(test|t|run\s+(build|test))(\s|$)/i];
// Next to a build in the same command: a change of folder, filters of its output, and an echo of its exit code.
const FOLDER_CHANGE = /^(cd|pushd|popd)(\s|$)/i;
const OUTPUT_FILTERS = /^(tail|head|grep|rg|wc|sort|uniq|cat|tee|echo)(\s|$)/i;
// A substitution runs a hidden command the check doesn't see.
const SUBSTITUTION = /\$\(|`/;

/** A build piped into a filter (`dotnet build | tail -5`) ends with the build's own exit code, not the filter's: the
 *  sandbox's outer pipefail doesn't reach the pipeline inside the command (run 4491 reported a failed build as exit 0). */
export function withOwnExitCode(command: string): string {
  return `set -o pipefail; ${command}`;
}

/** The command builds or tests and holds nothing else but folder changes and output filters. */
export function isSandboxBuildCommand(command: string, configured: string[]): boolean {
  if (SUBSTITUTION.test(command)) {
    return false;
  }

  if (configured.some((entry) => normalized(entry) === normalized(command))) {
    return true;
  }

  const segments = commandSegments(command);

  return segments.some((segment) => isBuildSegment(segment, configured)) && segments.every((segment) => isAllowedBeside(segment, configured));
}

function isAllowedBeside(segment: string, configured: string[]): boolean {
  return isBuildSegment(segment, configured) || FOLDER_CHANGE.test(segment) || OUTPUT_FILTERS.test(segment);
}

function isBuildSegment(segment: string, configured: string[]): boolean {
  return BUILD_COMMANDS.some((pattern) => pattern.test(segment)) || configured.some((entry) => startsWithCommand(segment, entry));
}

/** The configured command itself, or with more arguments (`dotnet test App.sln --filter X`). */
export function startsWithCommand(command: string, configured: string): boolean {
  const given = normalized(command);
  const expected = normalized(configured);

  return expected.length > 0 && (given === expected || given.startsWith(`${expected} `));
}

function normalized(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

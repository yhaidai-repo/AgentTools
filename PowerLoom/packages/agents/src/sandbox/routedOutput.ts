import type { CommandResult } from "@powerloom/sandbox";

// Claude Code cuts a shell result at 30,000 characters; the routed text stays under it with its own head and tail.
const MAX_ROUTED_CHARS = 25_000;
const HEAD_SHARE = 1 / 3;
const DIGEST_LINES = 60;
const DIGEST_LINE_CHARS = 240;
// The output keeps at least this much however long the lines before it are.
const MIN_OUTPUT_CHARS = 4_000;
// The lines a verifier needs when the output was cut: failed tests (dotnet test, xunit, node:test, jest, vitest),
// compiler errors, and the test summaries.
const FAILURE_LINES = String.raw`^[[:space:]]*(Failed |\[FAIL\]|not ok |FAIL |✕ |× )|error [A-Z]+[0-9]+:|(Failed|Passed)! +- |Total tests:|Tests: +[0-9]`;

const ERROR_COUNT = /^\s*(\d+) Error\(s\)/gm;
// NuGet's unresolved packages, an unrestored project, and a target a package should have brought (BundleMinify, run 4491).
const MISSING_PACKAGES = /\b(NU1100|NU1101|NU1102|NU1103|NETSDK1004|MSB4057)\b|assets file .* (not found|doesn't have a target)/i;

/** The sandbox command listing the failure lines of a whole output file, each once, in order. */
export function failureDigestCommand(outputFile: string): string {
  return `grep -E '${FAILURE_LINES}' -- '${outputFile}' | awk '!seen[$0]++' | head -n ${DIGEST_LINES} | cut -c 1-${DIGEST_LINE_CHARS}`;
}

/** What the run's shell shows for a routed command: where it ran, its notes, the failure lines of a cut output, and the
 *  output itself. */
export function routedText(folder: string, result: CommandResult, notes: string[], digest: string | null): string {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const status = result.timedOut ? `timed out after ${seconds} s and was killed` : `exit code ${result.exitCode} in ${seconds} s${errorCountText(result.output)}`;
  const header = `[Ran in the run's sandbox, in ${folder} of a fresh copy of the worktree: ${status}. The whole output is in ${result.outputFile} there.]`;
  const failures = digest ? [`[The output below is cut; its failure lines:]\n${digest.trimEnd()}`] : [];
  const lead = [header, ...[...notes, ...buildNotes(result)].map((note) => `[${note}]`), ...failures].join("\n");

  return `${lead}\n${cutMiddle(result.output, Math.max(MAX_ROUTED_CHARS - lead.length, MIN_OUTPUT_CHARS))}`;
}

/** The compiler's own error count (MSBuild's "N Error(s)") after the exit code, so a filtered output can't hide it. */
export function errorCountText(output: string): string {
  const counts = [...output.matchAll(ERROR_COUNT)];
  const last = counts.at(-1)?.[1];

  return last && last !== "0" ? `, ${last} error(s)` : "";
}

/** What a failed build's output asks for: packages the sandbox doesn't have yet come from sandbox_restore, not a
 *  conclusion that the repo can't build offline (run 4491 built with --no-restore and gave up). */
export function buildNotes(result: CommandResult): string[] {
  if (result.exitCode === 0 || !MISSING_PACKAGES.test(result.output)) {
    return [];
  }

  return ["Packages are missing: run sandbox_restore for the repo (with the solution or project as target when its root has none), then build again. If the restore fails, its exact error is the blocker to report."];
}

function cutMiddle(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }

  const head = Math.floor(max * HEAD_SHARE);
  const tail = max - head;

  return `${text.slice(0, head)}\n[… ${text.length - head - tail} characters cut …]\n${text.slice(text.length - tail)}`;
}

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

/** The sandbox command listing the failure lines of a whole output file, each once, in order. */
export function failureDigestCommand(outputFile: string): string {
  return `grep -E '${FAILURE_LINES}' -- '${outputFile}' | awk '!seen[$0]++' | head -n ${DIGEST_LINES} | cut -c 1-${DIGEST_LINE_CHARS}`;
}

/** What the run's shell shows for a routed command: where it ran, its notes, the failure lines of a cut output, and the
 *  output itself. */
export function routedText(folder: string, result: CommandResult, notes: string[], digest: string | null): string {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const status = result.timedOut ? `timed out after ${seconds} s and was killed` : `exit code ${result.exitCode} in ${seconds} s`;
  const header = `[Ran in the run's sandbox, in ${folder} of a fresh copy of the worktree: ${status}. The whole output is in ${result.outputFile} there.]`;
  const failures = digest ? [`[The output below is cut; its failure lines:]\n${digest.trimEnd()}`] : [];
  const lead = [header, ...notes.map((note) => `[${note}]`), ...failures].join("\n");

  return `${lead}\n${cutMiddle(result.output, Math.max(MAX_ROUTED_CHARS - lead.length, MIN_OUTPUT_CHARS))}`;
}

function cutMiddle(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }

  const head = Math.floor(max * HEAD_SHARE);
  const tail = max - head;

  return `${text.slice(0, head)}\n[… ${text.length - head - tail} characters cut …]\n${text.slice(text.length - tail)}`;
}

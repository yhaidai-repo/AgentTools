import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ShellRouted } from "../../models/ShellRouted";

const REPLAY_FOLDER = "agenttools-shell-routes";
const MAX_EXIT_CODE = 255;

// A routed command reaches the agent as an ordinary shell result: its call runs a command that prints the routed output
// from a file, removes the file and exits with the routed exit code, so the result has the shell tool's own shape.
export function replayCommand(callId: string, routed: ShellRouted): string {
  const folder = join(tmpdir(), REPLAY_FOLDER);
  const file = join(folder, `${callId.replace(/[^\w-]+/g, "_")}.txt`).replace(/\\/g, "/");

  mkdirSync(folder, { recursive: true });
  writeFileSync(file, routed.output, "utf8");

  return `cat -- ${quoted(file)}; rm -f -- ${quoted(file)}; exit ${exitCodeOf(routed.exitCode)}`;
}

function quoted(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`;
}

// A shell exit code is 0 to 255; anything else (a killed process) is a plain failure.
function exitCodeOf(code: number): number {
  return Number.isInteger(code) && code >= 0 && code <= MAX_EXIT_CODE ? code : 1;
}

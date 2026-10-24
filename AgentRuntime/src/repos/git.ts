import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_OUTPUT = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;

// git without a shell: arguments are passed as-is, so paths and queries can't inject commands.
// Never interactive (no credential prompt can hang it), and killed after `timeoutMs` with a clear error.
export async function git(args: string[], cwd?: string, authHeader?: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const auth = authHeader ? ["-c", `http.extraHeader=${authHeader}`] : [];

  try {
    const { stdout } = await run("git", [...auth, ...args], { cwd, maxBuffer: MAX_OUTPUT, timeout: timeoutMs, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });

    return stdout;
  } catch (error) {
    throw new Error(describeFailure(args, error, timeoutMs));
  }
}

export async function gitOrEmpty(args: string[], cwd?: string): Promise<string> {
  try {
    return await git(args, cwd);
  } catch (error) {
    // git grep exits with 1 when nothing matches.
    if (String(error).includes("exit code 1")) {
      return "";
    }

    throw error;
  }
}

function describeFailure(args: string[], error: unknown, timeoutMs: number): string {
  const failure = error as { killed?: boolean; signal?: string; code?: number; stderr?: string };
  const command = `git ${args.filter((arg) => !arg.startsWith("http.extraHeader")).join(" ")}`;

  if (failure.killed) {
    return `${command}: timed out after ${Math.round(timeoutMs / 60_000)} min`;
  }

  return `${command}: exit code ${failure.code ?? failure.signal ?? "?"}: ${(failure.stderr ?? String(error)).trim().slice(0, 500)}`;
}

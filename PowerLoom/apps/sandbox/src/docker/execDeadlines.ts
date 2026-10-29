// `timeout` sends SIGKILL this long after its first signal when the process ignores it.
const KILL_AFTER_SECONDS = 10;

// The backstop behind `timeout`: an exec's stream is dropped this long after the process's own limit, past the kill.
export const DEADLINE_MARGIN_MS = 30_000;

/** `argv` under coreutils `timeout`, which ends it after `limitMs` (exit 124, or 137 when it had to kill). */
export function underTimeout(argv: string[], limitMs: number): string[] {
  return ["timeout", `--kill-after=${KILL_AFTER_SECONDS}s`, `${Math.ceil(limitMs / 1000)}s`, ...argv];
}

/** The exec's deadline for a process `timeout` limits to `limitMs`. */
export function deadlineAfter(limitMs: number): number {
  return limitMs + DEADLINE_MARGIN_MS;
}

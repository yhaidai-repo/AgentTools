import type { RestoreStepResult } from "@powerloom/sandbox";
import type { RanStep } from "../models/RanStep";
import type { RestoreStep } from "../models/RestoreStep";

export const LOCKED_MODE = "--locked-mode";

// NuGet's "the package references have changed" under --locked-mode: the repo's packages.lock.json is out of date. A
// developer's plain restore rewrites it unnoticed, but locked mode stops before fetching the project's direct packages.
const STALE_LOCK_FILE = /\bNU1004\b/;

/**
 * Runs a step; a locked restore that fails on a stale lock file runs once more without --locked-mode. The lock file it
 * rewrites stays in the restore container, which is thrown away, so the repo is unchanged.
 */
export async function runWithStaleLockFallback(step: RestoreStep, run: (step: RestoreStep) => Promise<RestoreStepResult>): Promise<RanStep> {
  const locked = await run(step);

  if (!failedOnStaleLockFile(step, locked)) {
    return { result: locked, note: null };
  }

  const unlocked = await run(withoutLockedMode(step));

  return { result: { ...unlocked, durationMs: locked.durationMs + unlocked.durationMs }, note: staleLockFileNote(step) };
}

function failedOnStaleLockFile(step: RestoreStep, result: RestoreStepResult): boolean {
  return result.exitCode !== 0 && step.argv.includes(LOCKED_MODE) && STALE_LOCK_FILE.test(result.output);
}

function withoutLockedMode(step: RestoreStep): RestoreStep {
  return { ...step, argv: step.argv.filter((arg) => arg !== LOCKED_MODE) };
}

function staleLockFileNote(step: RestoreStep): string {
  return `lock file out of date for ${step.label} (NU1004): restored without ${LOCKED_MODE} (regenerate packages.lock.json in the repo)`;
}

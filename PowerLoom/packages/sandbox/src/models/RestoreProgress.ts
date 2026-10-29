import type { PackageCacheSize } from "./PackageCacheSize";
import type { RestoreStepNow } from "./RestoreStepNow";
import type { RestoreStepResult } from "./RestoreStepResult";

// What a running restore is doing, read while its call is still pending (a restore answers only at its end).
export interface RestoreProgress {
  /** `waiting` for the restores of the same package cache before it, `copying` the repo in, `restoring` its steps. */
  stage: "waiting" | "copying" | "restoring";
  startedAt: string;
  /** The restore's time left, counted from its call (SANDBOX_RESTORE_TIMEOUT_MS). */
  remainingMs: number;
  stepCount: number;
  /** The step running now; null before the first and after the last. */
  step: RestoreStepNow | null;
  /** The steps that ended, in order. */
  ended: Omit<RestoreStepResult, "output">[];
  /** The running step's last output line, cut short; null before it printed one. */
  lastLine: string | null;
  /** The package cache now; null when it couldn't be measured or no step has started. */
  cache: PackageCacheSize | null;
}

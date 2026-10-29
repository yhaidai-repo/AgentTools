import type { RestoreStepResult } from "./RestoreStepResult";

export interface RestoreResult {
  /** Every step ended with exit code 0. */
  ok: boolean;
  steps: RestoreStepResult[];
  /** What was found but not restored, and why (e.g. a package.json without a lock file), and what was restored other than planned (e.g. past a stale lock file). */
  skipped: string[];
  /** Where the agent's container sees the restored packages. */
  packagesPath: string;
}

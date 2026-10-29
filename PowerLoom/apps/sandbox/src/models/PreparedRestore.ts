import type { RestoreStep } from "./RestoreStep";

// A restore checked before its container starts: where in the copy it runs, and the packages it adds first.
export interface PreparedRestore {
  repoRoot: string;
  where: { folder: string; file: string | null };
  additions: RestoreStep[];
}

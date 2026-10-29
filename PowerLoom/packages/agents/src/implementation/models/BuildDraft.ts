import type { BuildContent } from "@powerloom/db";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface BuildDraft {
  build: { content: BuildContent; inspect: unknown } | null;
}

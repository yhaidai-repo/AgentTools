import type { HandoffView } from "@powerloom/core";

// What the review outcome is decided from: the review hand-offs the task waits for, the latest plan (its version and the
// PBI content hash it was made from) and the PBI's content hash now.
export interface ReviewFacts {
  reviews: HandoffView[];
  plan: { version: number; pbiContentHash: string | null } | null;
  pbiContentHash: string;
}

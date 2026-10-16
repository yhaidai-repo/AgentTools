// What Better Review stores in code_review.details (version 1); the review page shows the mode, the rules it added and
// the research it asked for. The summary markdown carries the rest.
export interface BetterReviewDetails {
  version: number;
  agent: "better-review";
  commit: string;
  mode: { kind: "full"; reason: string } | { kind: "follow-up"; baseCommit: string };
  rules: { id: string | null; kind: "decision" | "lesson"; rule: string; appliesTo: string; source: string }[];
  rulesPath: string;
  rulesSaved: boolean;
  researchTaskIds: string[];
  /** Thread id → the newest ADO comment id the review saw in it (absent before reviewer comments were tracked). */
  threadsSeen?: Record<string, number>;
}

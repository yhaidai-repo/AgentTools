// What the continued run had and spent, from its trace and usage record (null where it isn't known), and whether it
// started saving its output: a budget stop keeps a partial result, and a commit can fail partway.
export interface PreviousRunFacts {
  maxTurns: number | null;
  timeoutMs: number | null;
  budgetUsd: number | null;
  spentUsd: number | null;
  committed: boolean;
}

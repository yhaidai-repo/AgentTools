// A rule this run adds to the repo's review rules (the vault's `review-rules/<repo>.md`): a decision the team made
// (a fix the user declined with a reason the agent accepted) or a lesson (a point another reviewer caught and this
// review missed). Every later review of the repo reads it.
export interface ReviewRuleDraft {
  kind: "decision" | "lesson";
  /** One line, as an instruction to the reviewer, e.g. "Don't ask for paging on admin-only lists". */
  rule: string;
  /** Where it applies: paths, layers, kinds of change; "all" when everywhere. */
  appliesTo: string;
  reason: string;
  /** Where it comes from: "RC-6322-003" or "ADO thread 4412", with the PR. */
  source: string;
  /** The user's answer or the other reviewer's comment it rests on, quoted. */
  sourceText: string;
}

// How the agent weighed one thread another reviewer (or the author) left on the PR in Azure DevOps.
export interface ReviewerNote {
  threadId: number;
  /** covered: a comment of this review makes the same point; missed: a real point this review didn't make; disagree:
   *  the point is wrong; not_applicable: no review point (a question answered, praise, a copy of this review). */
  verdict: "covered" | "missed" | "disagree" | "not_applicable";
  coveredBy: string | null;
  note: string;
}

// What running one planned case showed.
export interface CaseResult {
  /** The case's title as planned. */
  case: string;
  criterion: string;
  verdict: "pass" | "fail" | "blocked" | "not_run";
  /** What was seen, against the expected result; for blocked / not_run: why. */
  observed: string;
  /** Recording files of the case on the host (video, trace, screenshots). */
  artifacts: string[];
  /** The bug a failed case produced: `bug:<n>` for the n-th bug reported in this run, or an existing bug id. */
  bug: string | null;
}

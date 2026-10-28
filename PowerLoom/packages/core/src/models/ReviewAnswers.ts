// A review human task's two fixed answers (gate approve): step 1 `approve` or `changes: …`, step 2 `ok` or the
// corrections of the facts and assumptions; empty when the step wasn't answered.
export interface ReviewAnswers {
  decision: string;
  facts: string;
}

// Where a review stands, from its latest review task: queued (open), reviewing (in progress), reviewed (done), failed
// (blocked after its failures), not reviewed (no task yet, or the last one was cancelled).
export type ReviewState = "queued" | "reviewing" | "reviewed" | "failed" | "not reviewed";

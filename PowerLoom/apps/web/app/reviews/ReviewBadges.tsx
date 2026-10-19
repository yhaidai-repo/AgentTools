import { isReviewClosed } from "@/lib/reviewLooks";
import type { ReviewRow } from "@/models/ReviewRow";
import type { ReviewState } from "@/models/ReviewState";

const STATE_LOOKS: Record<ReviewState, { label: string; className: string }> = {
  "not reviewed": { label: "Not reviewed", className: "review-none" },
  queued: { label: "Queued", className: "review-queued" },
  reviewing: { label: "Reviewing", className: "review-running" },
  reviewed: { label: "Reviewed", className: "review-done" },
  failed: { label: "Failed", className: "review-failed" },
};

// Where the review stands, in the colours of the Ice theme: teal once reviewed, a pulsing dot while an agent reviews,
// rose only when the review failed; a closed review is dimmed whatever its last state.
export function ReviewStatePill({ row }: { row: ReviewRow }) {
  const look = isReviewClosed(row) ? { label: "Closed", className: "review-closed" } : STATE_LOOKS[row.state];

  return <span className={`review-pill ${look.className}`}>{look.label}</span>;
}

// The PR moved past the reviewed commit: a calm amber mark, not an error (user decision 2026-10-02: no automatic
// re-review; the user reruns).
export function NewPushesMark({ row }: { row: ReviewRow }) {
  if (!row.hasNewCommits) {
    return null;
  }

  return <span className="new-pushes">{newPushesLabel(row.newPushes)}</span>;
}

export function newPushesLabel(newPushes: number | null): string {
  if (!newPushes) {
    return "New commits";
  }

  return `${newPushes} new push${newPushes === 1 ? "" : "es"}`;
}

import type { ReviewRow } from "@/models/ReviewRow";

// The review's state, and a notice when the PR moved past the reviewed commit (user decision 2026-10-02: no automatic
// re-review; the user reruns).
export function ReviewBadges({ row }: { row: ReviewRow }) {
  return (
    <span className="chips">
      <span className={row.state === "failed" ? "chip result-error" : "chip"}>{row.state}</span>
      {row.review.status === "closed" && <span className="chip">closed</span>}
      {row.hasNewCommits && <span className="chip result-error">{newCommitsLabel(row.newPushes)}</span>}
    </span>
  );
}

function newCommitsLabel(newPushes: number | null): string {
  if (!newPushes) {
    return "new commits";
  }

  return `${newPushes} new push${newPushes === 1 ? "" : "es"}`;
}

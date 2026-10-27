import assert from "node:assert/strict";
import { it } from "node:test";
import { isReviewClosed, matchesReviewStatus, reviewNeedsYou } from "./reviewLooks";
import { toReviewRead } from "./reviewReads";

it("historical closed/ready results cannot approve unresolved open or answered comments", () => {
  for (const status of ["open", "answered"] as const) {
    const row: any = { pr: { sourceRef: "refs/heads/a", targetRef: "refs/heads/main" }, review: { status: "closed", summaryMd: "Ready to merge" }, comments: { open: status === "open" ? 1 : 0, answered: status === "answered" ? 1 : 0, total: 1 }, allComments: [], tasks: [], runs: [] };
    assert.equal(isReviewClosed(row), false);
    assert.equal(matchesReviewStatus(row, "active"), true);
    assert.equal(reviewNeedsYou(row), true);
    const read = toReviewRead(row);
    assert.equal(read.status, "active"); assert.match(read.summaryMd!, /^Merge approval blocked/);
    assert.equal(row.review.summaryMd, "Ready to merge"); // historical snapshot is untouched
    row.comments = { open: 0, answered: 0, total: 1 };
    assert.equal(isReviewClosed(row), true);
  }
});

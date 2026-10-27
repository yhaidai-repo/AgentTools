import assert from "node:assert/strict";
import { it } from "node:test";
import { countReviewStatuses, isReviewClosed, matchesReviewStatus, reviewNeedsYou } from "./reviewLooks";
import { toReviewRead } from "./reviewReads";

it("closed reviews stay closed with historical unresolved comments without approving them", () => {
  for (const status of ["open", "answered"] as const) {
    const row: any = { pr: { sourceRef: "refs/heads/a", targetRef: "refs/heads/main" }, review: { status: "closed", summaryMd: "Ready to merge" }, comments: { open: status === "open" ? 1 : 0, answered: status === "answered" ? 1 : 0, total: 1 }, allComments: [], tasks: [], runs: [] };
    assert.equal(isReviewClosed(row), true);
    assert.equal(matchesReviewStatus(row, "active"), false);
    assert.equal(matchesReviewStatus(row, "closed"), true);
    assert.equal(matchesReviewStatus(row, "all"), true);
    assert.equal(reviewNeedsYou(row), false);
    const read = toReviewRead(row);
    assert.equal(read.status, "closed"); assert.match(read.summaryMd!, /^Merge approval blocked/);
    assert.equal(row.review.summaryMd, "Ready to merge"); // historical snapshot is untouched
    row.comments = { open: 0, answered: 0, total: 1 };
    assert.equal(isReviewClosed(row), true);
  }
});

it("review tabs and counts use saved lifecycle status independently of comment counts", () => {
  const rows: any[] = [
    { review: { status: "closed" }, comments: { open: 3, answered: 0, total: 8 }, hasNewCommits: true },
    { review: { status: "closed" }, comments: { open: 0, answered: 1, total: 1 }, hasNewCommits: false },
    { review: { status: "closed" }, comments: { open: 0, answered: 0, total: 2 }, hasNewCommits: false },
    { review: { status: "active" }, comments: { open: 1, answered: 0, total: 1 }, hasNewCommits: false },
    { review: { status: "active" }, comments: { open: 0, answered: 0, total: 0 }, hasNewCommits: false },
  ];
  assert.deepEqual(countReviewStatuses(rows), { active: 2, closed: 3, all: 5 });
  assert.deepEqual(rows.map(row => reviewNeedsYou(row)), [false, false, false, true, false]);
  assert.equal(rows.filter(row => matchesReviewStatus(row, "active")).length, 2);
  assert.equal(rows.filter(row => matchesReviewStatus(row, "closed")).length, 3);
});

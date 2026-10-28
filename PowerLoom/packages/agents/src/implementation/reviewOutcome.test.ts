import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HandoffView } from "@powerloom/core";
import type { ReviewFacts } from "./models/ReviewFacts";
import { decideReviewOutcome } from "./reviewOutcome";

const APPROVED = "### 1. Review the plan and decide\n\n`approve`\n\n### 2. Check the facts and assumptions it rests on\n\nok";
const CHANGES = "### 1. Review the plan and decide\n\nchanges: archive after 30 days, not 7\n\n### 2. Check the facts and assumptions it rests on\n\nok";
const CORRECTED = "### 1. Review the plan and decide\n\napprove\n\n### 2. Check the facts and assumptions it rests on\n\nThe nightly job host is the scheduler, not the API.";

function review(targetStatus: string, targetResolution: string | null): HandoffView {
  return {
    id: 1, from: { taskId: "DT-7-001", agent: "planning", runId: 41 }, toKind: "human", toItemId: "HT-7-002", intent: "review", gate: "approve",
    package: { body: "Review the plan.", refs: { results: [], items: [], notes: [] } }, status: "closed", createdAt: new Date(), closedAt: new Date(),
    targetStatus, targetResolution,
  };
}

function facts(overrides: Partial<ReviewFacts>): ReviewFacts {
  return { reviews: [review("done", APPROVED)], plan: { version: 2, pbiContentHash: "h1" }, pbiContentHash: "h1", ...overrides };
}

describe("decideReviewOutcome", () => {
  it("builds an approved plan of an unchanged PBI", () => {
    assert.deepEqual(decideReviewOutcome(facts({})), { kind: "approved", reviewId: "HT-7-002", planVersion: 2 });
  });

  it("hands a review that asked for changes back to planning with the changes", () => {
    const outcome = decideReviewOutcome(facts({ reviews: [review("done", CHANGES)] }));

    assert.deepEqual(outcome, { kind: "replan", reviewId: "HT-7-002", reason: "HT-7-002 asked for changes", corrections: "changes: archive after 30 days, not 7" });
  });

  it("hands an approval with corrected facts back to planning with the corrections", () => {
    const outcome = decideReviewOutcome(facts({ reviews: [review("done", CORRECTED)] }));

    assert.equal(outcome.kind, "replan");
    assert.match(outcome.kind === "replan" ? outcome.corrections : "", /^Corrected facts and assumptions: The nightly job host is the scheduler/);
  });

  it("goes back to planning when the PBI changed after its plan, but not for a plan without a stored hash", () => {
    const changed = decideReviewOutcome(facts({ pbiContentHash: "h2" }));
    const unknown = decideReviewOutcome(facts({ plan: { version: 2, pbiContentHash: null }, pbiContentHash: "h2" }));

    assert.deepEqual([changed.kind, changed.kind === "replan" ? changed.reason : ""], ["replan", "the PBI changed after plan v2 was made"]);
    assert.equal(unknown.kind, "approved");
  });

  it("stops for a person on a cancelled review, one without a decision, no review or no plan", () => {
    const outcomes = [
      decideReviewOutcome(facts({ reviews: [review("cancelled", null)] })),
      decideReviewOutcome(facts({ reviews: [review("done", "### 2. Check\n\nok")] })),
      decideReviewOutcome(facts({ reviews: [] })),
      decideReviewOutcome(facts({ plan: null })),
    ];

    assert.deepEqual(outcomes.map((outcome) => (outcome.kind === "blocked" ? outcome.reason : outcome.kind)), [
      "HT-7-002 was cancelled: the review never approved the plan.",
      "HT-7-002 closed without a review decision.",
      "The task waits for no plan review (a hand-off with gate approve): implement only a reviewed plan.",
      "HT-7-002 approved, but the PBI has no stored plan to implement.",
    ]);
  });

  it("reads the latest review when the plan was reviewed more than once", () => {
    const outcome = decideReviewOutcome(facts({ reviews: [review("done", CHANGES), review("done", APPROVED)] }));

    assert.equal(outcome.kind, "approved");
  });
});

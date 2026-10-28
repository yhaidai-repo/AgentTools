import { confirmsFacts, isApproval, reviewAnswers, type HandoffView } from "@powerloom/core";
import type { ReviewFacts } from "./models/ReviewFacts";
import type { ReviewOutcome } from "./models/ReviewOutcome";

// The review outcome comes first (user decision 2026-10-29): approve builds the plan; changes or corrected facts go back
// to planning, and so does a PBI changed since its plan (TaskDependencies releases a task however its dependency closed,
// so this check is the agent's); a cancelled review, or one closed without a decision, stops for a person.
export function decideReviewOutcome(facts: ReviewFacts): ReviewOutcome {
  const review = facts.reviews.at(-1);

  if (!review) {
    return { kind: "blocked", reason: "The task waits for no plan review (a hand-off with gate approve): implement only a reviewed plan." };
  }

  if (review.targetStatus !== "done") {
    return { kind: "blocked", reason: `${review.toItemId} was ${review.targetStatus}: the review never approved the plan.` };
  }

  return answeredOutcome(review, facts);
}

function answeredOutcome(review: HandoffView, facts: ReviewFacts): ReviewOutcome {
  const answers = reviewAnswers(review.targetResolution);
  const corrections = confirmsFacts(answers.facts) ? "" : `Corrected facts and assumptions: ${answers.facts}`;

  if (answers.decision === "") {
    return { kind: "blocked", reason: `${review.toItemId} closed without a review decision.` };
  }

  if (!isApproval(answers.decision)) {
    return { kind: "replan", reviewId: review.toItemId, reason: `${review.toItemId} asked for changes`, corrections: [answers.decision, corrections].filter(Boolean).join("\n\n") };
  }

  if (corrections) {
    return { kind: "replan", reviewId: review.toItemId, reason: `${review.toItemId} approved but corrected the facts the plan rests on`, corrections };
  }

  return planOutcome(review, facts);
}

function planOutcome(review: HandoffView, facts: ReviewFacts): ReviewOutcome {
  if (!facts.plan) {
    return { kind: "blocked", reason: `${review.toItemId} approved, but the PBI has no stored plan to implement.` };
  }

  if (hasPbiChanged(facts)) {
    return { kind: "replan", reviewId: review.toItemId, reason: `the PBI changed after plan v${facts.plan.version} was made`, corrections: "The PBI's title, description or acceptance criteria changed after the plan was made and reviewed: plan again from the PBI as it is now." };
  }

  return { kind: "approved", reviewId: review.toItemId, planVersion: facts.plan.version };
}

// A plan stored before the hash was kept can't tell; it counts as unchanged.
function hasPbiChanged(facts: ReviewFacts): boolean {
  const planned = facts.plan?.pbiContentHash ?? null;

  return planned !== null && planned !== facts.pbiContentHash;
}

// What a planning run handed off: questions, the gated plan review, and an implementation task behind that review.
export interface PlanningOutcome {
  hasAsked: boolean;
  hasReview: boolean;
  hasImplementation: boolean;
}

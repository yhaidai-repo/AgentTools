// A reviewer's vote as ADO counts it: 10 approved, 5 approved with suggestions, 0 no vote, -5 waiting for the author,
// -10 rejected.
export interface AdoReviewerVote {
  name: string;
  vote: number;
  isRequired: boolean;
}

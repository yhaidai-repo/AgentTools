// One numbered line of a Test Case's steps: an own or shared step, or a Shared Steps item ADO didn't return.
export type TestStepEntry =
  | { action: string; expected: string; sharedStepsId: number | null }
  | { missingSharedStepsId: number };

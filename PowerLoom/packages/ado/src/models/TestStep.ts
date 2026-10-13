// One entry of a Test Case's steps: an own step (action and expected result as ADO's HTML), or a Shared Steps item
// the case includes by id.
export type TestStep =
  | { kind: "step"; action: string; expected: string }
  | { kind: "shared"; sharedStepsId: number };

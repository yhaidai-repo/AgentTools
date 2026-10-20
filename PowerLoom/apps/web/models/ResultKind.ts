// Where an agent result is stored: a refinement or design version, an estimate, a result item (a research result or
// a test report), or a review run of a pull request. The full result page's URL starts with it: /results/<kind>/<id>.
export type ResultKind = "refinement" | "design" | "estimate" | "item" | "review";

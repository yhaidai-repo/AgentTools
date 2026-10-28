// Where an agent result is stored: a refinement, plan, build or design version, an estimate, a result item (a research result or
// a test report), a review run of a pull request, or a run result (what one run wrote with write_result). The full
// result page's URL starts with it: /results/<kind>/<id>.
export type ResultKind = "refinement" | "plan" | "build" | "design" | "estimate" | "item" | "review" | "run";

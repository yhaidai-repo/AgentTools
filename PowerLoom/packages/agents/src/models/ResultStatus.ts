// How far a result got: `partial` keeps what was found when a run stops early, `not_found` and `blocked` say why not.
export type ResultStatus = "complete" | "partial" | "not_found" | "blocked";

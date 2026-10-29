import type { ResultKind } from "./ResultKind";

// The result kinds a PBI owns versions of, as agents reference them (`PBI-<id>:<kind>`); an item, a review or a run
// result belongs to a task, a pull request or a run instead.
export type PbiResultKind = Extract<ResultKind, "refinement" | "plan" | "build" | "design" | "estimate">;

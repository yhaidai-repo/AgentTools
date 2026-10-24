import type { RunEstimate } from "../estimate/RunEstimate";
import type { RefinementOutput } from "./models/RefinementOutput";

// A refinement run is complete with its refinement and, when its Config grants record_estimate, its estimate: refinement
// must estimate (user decision 2026-10-18). Both refinement agents use it.
export function hasRefinementOutput(refinement: RefinementOutput | null, estimate: RunEstimate): boolean {
  return refinement !== null && !estimate.isMissing;
}

import type { InspectPhase } from "./InspectPhase";
import type { InspectRequirement } from "./InspectRequirement";

// The part of `gsd-tools planning inspect` the plan is read from; the whole snapshot is stored as it came.
export interface PlanningInspect {
  schema_version: number;
  phases?: InspectPhase[];
  requirements?: InspectRequirement[];
}

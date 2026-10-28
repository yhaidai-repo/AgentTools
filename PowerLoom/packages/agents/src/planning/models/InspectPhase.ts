import type { InspectPlan } from "./InspectPlan";

// A phase folder as `planning inspect` (schema_version 1) lists it; ROADMAP phases without a folder are missing.
export interface InspectPhase {
  dir: string;
  phase_id: string;
  plans?: InspectPlan[];
}

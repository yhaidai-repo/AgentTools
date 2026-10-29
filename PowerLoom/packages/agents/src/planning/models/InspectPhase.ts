import type { InspectPlan } from "./InspectPlan";
import type { InspectUatItem } from "./InspectUatItem";

// A phase folder as `planning inspect` (schema_version 1) lists it; ROADMAP phases without a folder are missing. After
// execution it also carries the verifier's status (passed, gaps_found, human_needed; null when none ran) and the UAT
// tests verify-work left unresolved.
export interface InspectPhase {
  dir: string;
  phase_id: string;
  plans?: InspectPlan[];
  verification?: { status?: string | null };
  uat?: { unresolved?: InspectUatItem[] };
}

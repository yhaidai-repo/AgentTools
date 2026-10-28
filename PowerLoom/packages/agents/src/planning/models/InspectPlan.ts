import type { InspectTask } from "./InspectTask";

// A plan file of a phase as `planning inspect` (schema_version 1) lists it.
export interface InspectPlan {
  id: string;
  file: string;
  superseded?: boolean;
  objective?: string | null;
  wave?: number | null;
  dependsOn?: string[];
  autonomous?: boolean;
  tasks?: InspectTask[];
}

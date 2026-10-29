import type { PhasePlanTask } from "./PhasePlanTask";

// One GSD plan (NN-MM-PLAN.md): its wave, what it covers, its tasks and the checks of its <verification> section.
export interface PhasePlan {
  id: string;
  phase: string;
  wave: number;
  objective: string;
  dependsOn: string[];
  autonomous: boolean;
  requirements: string[];
  tasks: PhasePlanTask[];
  tests: string[];
}

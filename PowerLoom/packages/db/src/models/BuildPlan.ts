import type { BuildPlanStatus } from "./BuildPlanStatus";

// One GSD plan as the implementation left it: its tasks done of all, the files it changed and its SUMMARY's one-liner.
export interface BuildPlan {
  id: string;
  phase: string;
  wave: number;
  objective: string;
  status: BuildPlanStatus;
  tasksDone: number;
  tasksTotal: number;
  changedFiles: string[];
  oneLiner: string;
}

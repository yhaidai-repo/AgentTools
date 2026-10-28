// One task of a GSD plan as `planning inspect` reports it.
export interface PhasePlanTask {
  name: string;
  type: string;
  files: string[];
  done: string;
  status: string;
}

import type { HumanTaskStep } from "./HumanTaskStep";

// A structured human task as agents create it (local_item.data; user decision 2026-10-05): why a person must do it,
// which problem the answer solves, and the steps.
export interface HumanTaskData {
  why: string;
  solves: string;
  steps: HumanTaskStep[];
}

import type { HumanTaskData } from "@adoa/core";

// A structured human task as an agent drafts it: its title plus why, solves and the steps.
export interface HumanTaskSpec {
  title: string;
  data: HumanTaskData;
}

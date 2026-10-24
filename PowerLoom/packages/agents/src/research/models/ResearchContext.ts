import type { localItem, workItem } from "@powerloom/db";

// Everything one research run is about: the task and its PBI.
export interface ResearchContext {
  task: typeof localItem.$inferSelect;
  pbi: typeof workItem.$inferSelect;
}

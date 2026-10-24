import type { bug, workItem } from "@powerloom/db";

type WorkItemRow = typeof workItem.$inferSelect;

// A child item of a PBI as lists show it; bugSource is null for a child that isn't a bug.
export type ChildItem = Pick<WorkItemRow, "adoId" | "title" | "type" | "source" | "adoState" | "pipelineStatus"> & {
  bugSource: (typeof bug.$inferSelect)["source"] | null;
};

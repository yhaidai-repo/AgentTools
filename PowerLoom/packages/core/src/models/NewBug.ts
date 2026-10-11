import type { bug } from "@powerloom/db";

// A bug to record: its child work item, the parent PBI, where it came from and who reported it.
export type NewBug = Pick<typeof bug.$inferInsert, "workItemId" | "pbiId" | "source" | "reportedBy">;

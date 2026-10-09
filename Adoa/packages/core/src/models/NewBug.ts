import type { bug } from "@adoa/db";

// A bug to record: its child work item, the parent PBI, where it came from and who reported it.
export type NewBug = Pick<typeof bug.$inferInsert, "workItemId" | "pbiId" | "source" | "reportedBy">;

import type { bug } from "@adoa/db";

// A child item's bug record: where it came from and when in the parent's life it was found.
export type BugInfo = Pick<typeof bug.$inferSelect, "source" | "foundIn" | "reportedBy" | "createdAt">;

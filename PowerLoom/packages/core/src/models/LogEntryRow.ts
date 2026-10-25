import type { logEntry } from "@powerloom/db";

// One recorded warning or error as read back: its latest text, how often and when it happened, what it is about.
export type LogEntryRow = typeof logEntry.$inferSelect;

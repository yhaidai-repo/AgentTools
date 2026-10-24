import type { dataAccess } from "@powerloom/db";

// One row of the data access log as written: an agent tool's call (with its run) or a chat's CLI read (no run).
export type DataAccessRow = typeof dataAccess.$inferInsert;

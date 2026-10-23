import type { dataAccess } from "@powerloom/db";

// One logged call of the data access log as read back (DataAccessRow is the row as written).
export type DataAccessCall = typeof dataAccess.$inferSelect;

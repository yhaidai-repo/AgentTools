import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, ne } from "drizzle-orm";
import type { PreviousReport } from "./models/PreviousReport";
import type { TestReport } from "./models/TestReport";

// The task's latest test report (a TR item under the task), so the next run continues from its plan instead of
// deriving it again; null when the task never wrote one.
export async function loadPreviousReport(db: PowerLoomDb, taskId: string): Promise<PreviousReport | null> {
  const [row] = await db
    .select({ id: localItem.id, data: localItem.data })
    .from(localItem)
    .where(and(eq(localItem.parentId, taskId), eq(localItem.kind, "test-report"), ne(localItem.status, "deleted")))
    .orderBy(desc(localItem.createdAt), desc(localItem.id))
    .limit(1);
  const report = (row?.data as { report?: TestReport } | null)?.report;

  return row && report ? { id: row.id, report } : null;
}

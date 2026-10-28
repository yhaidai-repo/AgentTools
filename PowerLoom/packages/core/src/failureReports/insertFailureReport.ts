import { runFailureReport, type PowerLoomDb } from "@powerloom/db";
import type { NewFailureReport } from "../models/NewFailureReport";

// The one writer of a report, whoever reports it; the row's id is shown as FR-<id>.
export async function insertFailureReport(db: PowerLoomDb, report: NewFailureReport): Promise<number> {
  const [row] = await db.insert(runFailureReport).values(report).returning({ id: runFailureReport.id });

  return row.id;
}

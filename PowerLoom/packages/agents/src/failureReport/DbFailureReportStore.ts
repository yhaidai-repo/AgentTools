import { runFailureReport, type PowerLoomDb } from "@powerloom/db";
import type { FailureReportStore } from "./models/FailureReportStore";
import type { NewFailureReport } from "./models/NewFailureReport";

export class DbFailureReportStore implements FailureReportStore {
  constructor(private readonly db: PowerLoomDb) {}

  async add(report: NewFailureReport): Promise<number> {
    const [row] = await this.db.insert(runFailureReport).values({ ...report, origin: "run" }).returning({ id: runFailureReport.id });

    return row.id;
  }
}

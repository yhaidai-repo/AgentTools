import { insertFailureReport } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { FailureReportStore } from "./models/FailureReportStore";
import type { NewFailureReport } from "@powerloom/core";

export class DbFailureReportStore implements FailureReportStore {
  constructor(private readonly db: PowerLoomDb) {}

  add(report: NewFailureReport): Promise<number> {
    return insertFailureReport(this.db, report);
  }
}

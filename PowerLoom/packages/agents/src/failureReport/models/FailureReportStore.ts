import type { NewFailureReport } from "@powerloom/core";

// Where reports are kept; the id is the row's, shown as FR-<id>.
export interface FailureReportStore {
  add(report: NewFailureReport): Promise<number>;
}

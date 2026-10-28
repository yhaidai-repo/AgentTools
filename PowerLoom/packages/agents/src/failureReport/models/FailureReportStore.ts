import type { NewFailureReport } from "./NewFailureReport";

// Where reports are kept; the id is the row's, shown as FR-<id>.
export interface FailureReportStore {
  add(report: NewFailureReport): Promise<number>;
}

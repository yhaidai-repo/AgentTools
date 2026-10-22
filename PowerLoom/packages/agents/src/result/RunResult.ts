import type { ResultDraft } from "./models/ResultDraft";

// The result one run recorded with write_result: the latest call counts. It is written with the run's other outputs once
// the run succeeds.
export class RunResult {
  private recorded: ResultDraft | null = null;

  get latest(): ResultDraft | null {
    return this.recorded;
  }

  /** The run has its result: the generic success rule once every agent ends with write_result. */
  get isWritten(): boolean {
    return this.recorded !== null;
  }

  record(result: ResultDraft): void {
    this.recorded = result;
  }
}

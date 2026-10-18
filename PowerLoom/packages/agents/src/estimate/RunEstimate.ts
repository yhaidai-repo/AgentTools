import type { EstimateDraft } from "./models/EstimateDraft";

// The estimate one run recorded: the latest call counts. It is written with the run's other outputs once the run succeeds.
export class RunEstimate {
  private recorded: EstimateDraft | null = null;

  /** `isOffered`: the run has record_estimate (its agent's grant, on a PBI). */
  constructor(readonly isOffered: boolean) {}

  get latest(): EstimateDraft | null {
    return this.recorded;
  }

  /** Offered but not called: a run that must estimate (refinement) isn't complete then. */
  get isMissing(): boolean {
    return this.isOffered && this.recorded === null;
  }

  record(estimate: EstimateDraft): void {
    this.recorded = estimate;
  }
}

import type { NewFailureReport } from "@powerloom/core";

// A run keeps this many reports; a run that fails more often puts the rest in its result.
export const MAX_REPORTS_PER_RUN = 20;

// What a run has reported so far: the cap, and one report per cause (same kind, tool and target).
export class FailureReportRun {
  private readonly ids = new Map<string, number>();

  get isFull(): boolean {
    return this.ids.size >= MAX_REPORTS_PER_RUN;
  }

  idOf(report: Pick<NewFailureReport, "kind" | "tool" | "target">): number | undefined {
    return this.ids.get(causeOf(report));
  }

  remember(report: Pick<NewFailureReport, "kind" | "tool" | "target">, id: number): void {
    this.ids.set(causeOf(report), id);
  }
}

function causeOf(report: Pick<NewFailureReport, "kind" | "tool" | "target">): string {
  return [report.kind, report.tool ?? "", report.target.toLowerCase()].join("|");
}

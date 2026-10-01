import type { AgentEvent, ResultEvent } from "@agenttools/runtime";
import type { BudgetGuard, TraceRecorder, UsageTracker } from "@agenttools/usage";

// Watches one run's events: records the trace, adds usage, and aborts when the per-run budget is used up.
export class RunObserver {
  readonly abort = new AbortController();
  private result: ResultEvent | null = null;
  private resetsAt: Date | null = null;
  private wasAbortedForBudget = false;

  constructor(
    private readonly tracker: UsageTracker,
    private readonly trace: TraceRecorder,
    private readonly guard: BudgetGuard,
  ) {}

  get resultEvent(): ResultEvent | null {
    return this.result;
  }

  get rateLimitResetsAt(): Date | null {
    return this.resetsAt;
  }

  get isBudgetAbort(): boolean {
    return this.wasAbortedForBudget;
  }

  async observe(event: AgentEvent): Promise<void> {
    await this.trace.record({ ...event });

    switch (event.type) {
      case "usage":
        this.addUsage(event);
        break;
      case "rate_limit":
        this.resetsAt = event.status === "rejected" ? event.resetsAt : this.resetsAt;
        break;
      case "result":
        this.result = event;
        break;
      default:
        break;
    }
  }

  private addUsage(event: Extract<AgentEvent, { type: "usage" }>): void {
    this.tracker.add(event);

    if (this.guard.isRunOverBudget(this.tracker.costUsd) && !this.abort.signal.aborted) {
      this.wasAbortedForBudget = true;
      this.abort.abort("budget-exceeded");
    }
  }
}

import type { AgentEvent, ResultEvent } from "@agenttools/runtime";
import type { BudgetGuard, UsageTracker } from "@agenttools/usage";
import type { ToolCallLogger } from "./ToolCallLogger";

type Record = (entry: { type: string; [field: string]: unknown }) => Promise<void>;

// Watches one run's agent events: traces them, logs every tool call, adds usage, and aborts when the per-run budget is
// used up.
export class RunObserver {
  readonly abort = new AbortController();
  private result: ResultEvent | null = null;
  private resetsAt: Date | null = null;
  private wasAbortedForBudget = false;

  constructor(
    private readonly tracker: UsageTracker,
    private readonly guard: BudgetGuard,
    private readonly record: Record,
    private readonly tools: ToolCallLogger,
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
    const { runId, seq, at, ...body } = event;

    await this.record(body);
    await this.tools.observe(event);

    switch (event.type) {
      case "usage":
        this.addUsage(event);
        break;
      case "rate_limit":
        this.tracker.addSubscription(event.windows ?? []);
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

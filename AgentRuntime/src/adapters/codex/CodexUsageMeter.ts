import type { EventBody } from "../../EventSequence";
import type { CodexRollouts } from "./CodexRollouts";
import type { CodexTokenTotals } from "./models/CodexTokenTotals";
import { equalTotals, validTotals } from "./settledUsage";

const NONE: CodexTokenTotals = { input: 0, cachedInput: 0, output: 0 };

// Codex reports a turn's tokens only when the turn completes, and a run that is cut off (turn limit, time, Stop, budget)
// never completes it: such a run reported no tokens, and the budget never saw a Codex run's spend while it ran. The
// thread's rollout keeps running totals (token_count), so the meter reports what was used since its last report, after
// each tool call or message and once more at the end. A resumed thread's earlier runs are the baseline, not this run's.
// Usage is optional: a rollout that is missing or unreadable reports nothing, and the turn's own usage counts instead.
export class CodexUsageMeter {
  private path: string | null = null;
  private reported: CodexTokenTotals = NONE;
  private hasReported = false;
  private isOff = false;
  private baselineKnown = true;
  private monotonic = true;

  constructor(private readonly rollouts: CodexRollouts, private readonly model: string) {}

  /** A resumed thread: what it had used before this run isn't this run's. */
  async begin(resumedThread: string | null): Promise<void> {
    const baseline = resumedThread ? await this.totals(resumedThread) : NONE;
    this.baselineKnown = baseline !== null && validTotals(baseline);
    this.reported = this.baselineKnown ? baseline! : NONE;
  }

  /** What the thread used since the last report, as a usage event; none when nothing new is in the rollout. */
  async usage(threadId: string | null): Promise<EventBody[]> {
    const totals = this.isOff || !threadId ? null : await this.totals(threadId);

    if (totals && (!validTotals(totals) || totals.input < this.reported.input || totals.cachedInput < this.reported.cachedInput || totals.output < this.reported.output || totals.cachedInput - this.reported.cachedInput > totals.input - this.reported.input)) {
      this.monotonic = false;
      return [];
    }

    if (!totals || (totals.input <= this.reported.input && totals.output <= this.reported.output)) {
      return [];
    }

    const used = { input: totals.input - this.reported.input, cachedInput: Math.max(0, totals.cachedInput - this.reported.cachedInput), output: Math.max(0, totals.output - this.reported.output) };

    this.reported = totals;
    this.hasReported = true;

    return [{ type: "usage", model: this.model, inputTokens: Math.max(0, used.input - used.cachedInput), outputTokens: used.output, cacheReadTokens: used.cachedInput, cacheWriteTokens: 0 }];
  }

  /** At a completed turn: the rollout's remainder once the meter reports, otherwise the turn's own usage (and the meter
   *  stops, so nothing counts twice). */
  async atTurnEnd(threadId: string | null, turnUsage: EventBody[]): Promise<EventBody[]> {
    const metered = await this.usage(threadId);

    if (this.hasReported) {
      return metered;
    }

    this.isOff = true;

    return turnUsage;
  }

  async settledAtTurnLimit(threadId: string | null): Promise<boolean> {
    if (!threadId || !this.baselineKnown || !this.monotonic || !this.hasReported || this.isOff) return false;
    const totals = await this.rollouts.settledTotals(threadId);
    return totals !== null && equalTotals(totals, this.reported);
  }

  private async totals(threadId: string): Promise<CodexTokenTotals | null> {
    this.path = this.path ?? (await this.rollouts.findThread(threadId));

    return this.path ? this.rollouts.latestTotals(this.path) : null;
  }
}

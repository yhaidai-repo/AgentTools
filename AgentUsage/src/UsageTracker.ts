import type { FinishInfo } from "./models/FinishInfo";
import type { ModelUsage } from "./models/ModelUsage";
import type { TokenTotals } from "./models/TokenTotals";
import type { UsageEvent } from "./models/UsageEvent";
import type { UsageLabels } from "./models/UsageLabels";
import type { UsageRecord } from "./models/UsageRecord";
import { baseModel, type PriceBook } from "./PriceBook";
import type { SubscriptionSample } from "./models/SubscriptionSample";
import type { SubscriptionUsage } from "./models/SubscriptionUsage";
import { addSubscriptionSample } from "./subscription";
import { addTokens, emptyTokens } from "./tokens";

// Accumulates one run's usage events into a usage record; cost is fixed with the prices valid at start.
export class UsageTracker {
  private readonly startedAt = new Date();
  // Working time comes from the monotonic clock: it stands still while the machine (or Docker's VM) sleeps, so a run that
  // was paused overnight isn't recorded as running for hours. startedAt / endedAt stay wall-clock times.
  private readonly startedTick = performance.now();
  private readonly perModel = new Map<string, TokenTotals>();
  private readonly subscription = new Map<string, SubscriptionUsage>();

  constructor(
    private readonly runId: string,
    private readonly labels: UsageLabels,
    private readonly prices: PriceBook,
  ) {}

  add(event: UsageEvent): void {
    const model = baseModel(event.model);

    this.perModel.set(model, addTokens(this.perModel.get(model) ?? emptyTokens(), event));
  }

  addSubscription(samples: SubscriptionSample[]): void {
    for (const sample of samples) {
      addSubscriptionSample(this.subscription, sample);
    }
  }

  get costUsd(): number {
    return this.modelUsage().reduce((sum, usage) => sum + usage.costUsd, 0);
  }

  finish(info: FinishInfo): UsageRecord {
    const endedAt = new Date();
    const models = this.modelUsage();
    const tokens = models.reduce<TokenTotals>((sum, usage) => addTokens(sum, usage), emptyTokens());

    return {
      runId: this.runId,
      labels: this.labels,
      startedAt: this.startedAt,
      endedAt,
      durationMs: Math.round(performance.now() - this.startedTick),
      turns: info.turns,
      outcome: info.outcome,
      error: info.error ?? null,
      ...tokens,
      costUsd: this.costUsd,
      providerCostUsd: info.providerCostUsd ?? null,
      models,
      subscription: [...this.subscription.values()],
    };
  }

  private modelUsage(): ModelUsage[] {
    return [...this.perModel].map(([model, tokens]) => ({ model, ...tokens, ...this.prices.cost(model, tokens, this.startedAt) }));
  }
}

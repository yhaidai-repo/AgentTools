import type { FinishInfo } from "./models/FinishInfo";
import type { ModelUsage } from "./models/ModelUsage";
import type { TokenTotals } from "./models/TokenTotals";
import type { UsageEvent } from "./models/UsageEvent";
import type { UsageLabels } from "./models/UsageLabels";
import type { UsageRecord } from "./models/UsageRecord";
import { baseModel, type PriceBook } from "./PriceBook";
import { addTokens, emptyTokens } from "./tokens";

// Accumulates one run's usage events into a usage record; cost is fixed with the prices valid at start.
export class UsageTracker {
  private readonly startedAt = new Date();
  private readonly perModel = new Map<string, TokenTotals>();

  constructor(
    private readonly runId: string,
    private readonly labels: UsageLabels,
    private readonly prices: PriceBook,
  ) {}

  add(event: UsageEvent): void {
    const model = baseModel(event.model);

    this.perModel.set(model, addTokens(this.perModel.get(model) ?? emptyTokens(), event));
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
      durationMs: endedAt.getTime() - this.startedAt.getTime(),
      turns: info.turns,
      outcome: info.outcome,
      error: info.error ?? null,
      ...tokens,
      costUsd: this.costUsd,
      providerCostUsd: info.providerCostUsd ?? null,
      models,
    };
  }

  private modelUsage(): ModelUsage[] {
    return [...this.perModel].map(([model, tokens]) => ({ model, ...tokens, ...this.prices.cost(model, tokens, this.startedAt) }));
  }
}

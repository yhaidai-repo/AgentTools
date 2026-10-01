import type { BudgetDecision } from "./models/BudgetDecision";
import type { BudgetPolicy } from "./models/BudgetPolicy";
import type { DailyBudget } from "./models/DailyBudget";
import type { UsageLabels } from "./models/UsageLabels";
import type { UsageStore } from "./models/UsageStore";

// Before a run: are today's daily budgets still open? During a run: is the per-run budget used up?
// Enforcement is the caller's: it aborts the run (e.g. through the runtime's abort signal) when told to.
export class BudgetGuard {
  constructor(
    private readonly policy: BudgetPolicy,
    private readonly store: UsageStore,
  ) {}

  async canStart(labels: UsageLabels, now = new Date()): Promise<BudgetDecision> {
    const applicable = this.policy.daily.filter((budget) => matches(labels, budget.match));
    const dayStart = startOfUtcDay(now);
    const decisions = await Promise.all(applicable.map((budget) => this.checkDaily(budget, dayStart)));

    return decisions.find((decision) => !decision.allowed) ?? { allowed: true, reason: null };
  }

  isRunOverBudget(costUsd: number): boolean {
    return this.policy.perRunUsd !== null && costUsd > this.policy.perRunUsd;
  }

  private async checkDaily(budget: DailyBudget, dayStart: Date): Promise<BudgetDecision> {
    const spent = await this.store.costSince(dayStart, budget.match);
    const scope = Object.keys(budget.match).length > 0 ? JSON.stringify(budget.match) : "all runs";

    return spent < budget.limitUsd
      ? { allowed: true, reason: null }
      : { allowed: false, reason: `Daily budget reached for ${scope}: $${spent.toFixed(4)} of $${budget.limitUsd.toFixed(2)}` };
  }
}

function matches(labels: UsageLabels, match: UsageLabels): boolean {
  return Object.entries(match).every(([key, value]) => labels[key] === value);
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

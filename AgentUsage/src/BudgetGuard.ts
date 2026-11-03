import { budgetDayStart } from "./budgetDay";
import { BudgetReservations, SHARED_BUDGET_RESERVATIONS, matchesLabels, type BudgetReservation } from "./BudgetReservations";
import { IncompleteAccountingError } from "./IncompleteAccountingError";
import type { BudgetDecision } from "./models/BudgetDecision";
import type { BudgetPolicy } from "./models/BudgetPolicy";
import type { DailyBudget } from "./models/DailyBudget";
import type { UsageLabels } from "./models/UsageLabels";
import type { UsageStore } from "./models/UsageStore";

// A start that holds its share: `reservation` is null when the start was refused.
export interface ReservedStart extends BudgetDecision {
  reservation: BudgetReservation | null;
}

// Before a run: are today's daily budgets still open? During a run: is the per-run budget used up?
// Enforcement is the caller's: it aborts the run (e.g. through the runtime's abort signal) when told to.
// Runs in progress count too: what they reserved at their start (`reserve`) is spent until they settle, so parallel
// runs can't all pass a check that only one of them fits.
export class BudgetGuard {
  constructor(
    private readonly policy: BudgetPolicy,
    private readonly store: UsageStore,
    private readonly reservations: BudgetReservations = SHARED_BUDGET_RESERVATIONS,
  ) {}

  async canStart(labels: UsageLabels, now = new Date()): Promise<BudgetDecision> {
    const applicable = this.policy.daily.filter((budget) => matchesLabels(labels, budget.match));
    const dayStart = budgetDayStart(now);
    const decisions = await Promise.all(applicable.map((budget) => this.checkDaily(budget, dayStart)));

    return decisions.find((decision) => !decision.allowed) ?? { allowed: true, reason: null };
  }

  // `canStart` plus a reservation of `amountUsd` (the run's expected cost, e.g. its per-run budget) that counts
  // against the daily budgets until the caller releases it, after the run's cost is in the store. Decisions are
  // taken one at a time, so two runs starting together see each other's reservation.
  reserve(labels: UsageLabels, amountUsd: number, now = new Date()): Promise<ReservedStart> {
    return this.reservations.serialize(async () => {
      const decision = await this.canStart(labels, now);

      return { ...decision, reservation: decision.allowed ? this.reservations.add(labels, amountUsd) : null };
    });
  }

  isRunOverBudget(costUsd: number): boolean {
    return this.policy.perRunUsd !== null && costUsd > this.policy.perRunUsd;
  }

  private async checkDaily(budget: DailyBudget, dayStart: Date): Promise<BudgetDecision> {
    let spent: number;
    try {
      spent = await this.store.costSince(dayStart, budget.match);
    } catch (error) {
      if (error instanceof IncompleteAccountingError) return { allowed: false, reason: error.message };
      throw error;
    }
    const reserved = this.reservations.reservedFor(budget.match);
    const scope = Object.keys(budget.match).length > 0 ? JSON.stringify(budget.match) : "all runs";
    const held = reserved > 0 ? ` plus $${reserved.toFixed(4)} reserved by runs in progress` : "";

    return spent + reserved < budget.limitUsd
      ? { allowed: true, reason: null }
      : { allowed: false, reason: `Daily budget reached for ${scope}: $${spent.toFixed(4)}${held} of $${budget.limitUsd.toFixed(2)}` };
  }
}

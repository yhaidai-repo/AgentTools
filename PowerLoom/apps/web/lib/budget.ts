// Client components (DailyBudgetStatus) use these, so the browser bundle must not pull core's barrel, which reaches the
// database driver; the budget rules are a pure module, imported by its path.
export { BUDGET_WARN_AT, budgetLevel, isNearBudget } from "@powerloom/core/src/agentStats/budget";
export type { BudgetLevel } from "@powerloom/core/src/models/BudgetLevel";

// How full a budget meter is: 0–1 of the limit (a limit of 0 shows any spend as full).
export function budgetFill(spent: number | null, limit: number): number {
  if (spent === null) return 0;
  return Math.min(spent / Math.max(limit, 0.01), 1);
}

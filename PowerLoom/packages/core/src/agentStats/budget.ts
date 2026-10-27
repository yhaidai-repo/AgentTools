import type { BudgetLevel } from "../models/BudgetLevel";

// A budget is near its limit from 80 % (the attention rule in PowerLoom uses the same share).
export const BUDGET_WARN_AT = 0.8;

// Null without a limit: nothing to measure against.
export function budgetLevel(spent: number | null, limit: number): BudgetLevel | null {
  if (spent === null || limit <= 0) {
    return null;
  }

  return spent >= limit ? "critical" : spent >= limit * BUDGET_WARN_AT ? "warning" : "good";
}

export function isNearBudget(spent: number | null, limit: number): boolean {
  if (spent === null) return true;
  const level = budgetLevel(spent, limit);

  return level !== null && level !== "good";
}

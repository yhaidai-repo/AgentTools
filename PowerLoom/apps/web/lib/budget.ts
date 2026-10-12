export type BudgetLevel = "good" | "warning" | "critical";

// A budget is near its limit from 80 % (the attention rule in PowerLoom uses the same share).
export const BUDGET_WARN_AT = 0.8;

// Null without a limit: nothing to measure against.
export function budgetLevel(spent: number, limit: number): BudgetLevel | null {
  if (limit <= 0) {
    return null;
  }

  return spent >= limit ? "critical" : spent >= limit * BUDGET_WARN_AT ? "warning" : "good";
}

export function isNearBudget(spent: number, limit: number): boolean {
  const level = budgetLevel(spent, limit);

  return level !== null && level !== "good";
}

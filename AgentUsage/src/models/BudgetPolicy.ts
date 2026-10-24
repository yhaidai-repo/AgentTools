import type { DailyBudget } from "./DailyBudget";

export interface BudgetPolicy {
  perRunUsd: number | null;
  daily: DailyBudget[];
}

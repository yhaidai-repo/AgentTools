// The global daily budget and what all agents spent today, as PowerLoom's status reports it.
export interface BudgetStatus {
  dailyLimitUsd: number;
  spentTodayUsd: number;
}

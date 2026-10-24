// Daily budgets count from 00:00 UTC: the same day for every host and time zone.
export function budgetDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

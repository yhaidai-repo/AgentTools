import { IncompleteAccountingError } from "./IncompleteAccountingError";
import type { UsageRecord } from "./models/UsageRecord";

// A human-authorized reservation is a budget charge, never a claim that provider accounting is complete.
export function budgetCost(record: Pick<UsageRecord, "costUsd" | "accountingComplete" | "budgetReservationUsd">): number {
  if (record.accountingComplete !== false) return record.costUsd;
  const reserved = record.budgetReservationUsd;
  if (typeof reserved !== "number" || !Number.isFinite(reserved) || reserved <= 0 || reserved < record.costUsd) throw new IncompleteAccountingError();
  return reserved;
}

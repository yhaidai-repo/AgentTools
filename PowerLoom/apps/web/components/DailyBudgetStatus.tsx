"use client";

import { isNearBudget } from "@/lib/budget";
import { formatUsd } from "@/lib/format";

// Today's spending against a daily budget, and when the budget day ends (00:00 UTC, shown in the viewer's time zone).
export function DailyBudgetStatus({ spentUsd, limitUsd }: { spentUsd: number | null; limitUsd: number }) {
  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const time = nextReset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isNearLimit = isNearBudget(spentUsd, limitUsd);

  return (
    <span className="muted">
      Used today: <strong className={isNearLimit ? "result-error" : undefined}>{formatUsd(spentUsd)}</strong> of {formatUsd(limitUsd)}.
      Resets at <time dateTime={nextReset.toISOString()} suppressHydrationWarning>{time}</time> your time (00:00 UTC).
    </span>
  );
}

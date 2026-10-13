import { StatTile } from "@/components/StatTile";
import { isNearBudget } from "@/lib/budget";
import { formatUsd } from "@/lib/format";
import type { SystemStatus } from "@/lib/systemStatus";
import type { DayActivity } from "@/models/DayActivity";

interface SummaryProps {
  days: DayActivity[];
  budget: SystemStatus["budget"] | null;
  stuck: number;
  held: number;
  periodLabel: string;
}

// The period's totals and today's budget in one row of tiles, before the charts.
export function Summary({ days, budget, stuck, held, periodLabel }: SummaryProps) {
  const cost = days.reduce((sum, day) => sum + dayCost(day), 0);
  const runs = days.reduce((sum, day) => sum + day.runs, 0);
  const failures = days.reduce((sum, day) => sum + day.failures, 0);
  const budgetStops = days.reduce((sum, day) => sum + day.budgetStops, 0);
  const period = periodLabel.toLowerCase();

  return (
    <div className="stat-tiles">
      <StatTile label={`Spent, ${period}`} value={formatUsd(cost)} />
      <StatTile label={`Runs, ${period}`} value={String(runs)} note={`${failures > 0 ? `${failures} failed` : "none failed"}, ${budgetStops} over budget`} alert={failures > 0} />
      <StatTile label="Budget today" value={budget ? formatUsd(budget.spentTodayUsd) : "?"} note={budget ? `of ${formatUsd(budget.dailyLimitUsd)}` : "PowerLoom doesn't answer"} alert={budget !== null && isNearBudget(budget.spentTodayUsd, budget.dailyLimitUsd)} />
      <StatTile label="Blocked" value={String(stuck + held)} note={`${stuck} stuck, ${held} held`} alert={stuck > 0} />
    </div>
  );
}

function dayCost(day: DayActivity): number {
  return Object.values(day.costByAgent).reduce((sum, value) => sum + value, 0);
}

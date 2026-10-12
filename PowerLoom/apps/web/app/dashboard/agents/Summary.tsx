import { formatUsd } from "@/lib/format";
import type { SystemStatus } from "@/lib/systemStatus";
import type { DayActivity } from "@/models/DayActivity";

const WARN_AT = 0.8;

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
  const period = periodLabel.toLowerCase();

  return (
    <div className="stat-tiles">
      <Tile label={`Spent, ${period}`} value={formatUsd(cost)} />
      <Tile label={`Runs, ${period}`} value={String(runs)} note={failures > 0 ? `${failures} failed` : "none failed"} alert={failures > 0} />
      <Tile label="Budget today" value={budget ? formatUsd(budget.spentTodayUsd) : "?"} note={budget ? `of ${formatUsd(budget.dailyLimitUsd)}` : "PowerLoom doesn't answer"} alert={isNearLimit(budget)} />
      <Tile label="Blocked" value={String(stuck + held)} note={`${stuck} stuck, ${held} held`} alert={stuck > 0} />
    </div>
  );
}

function dayCost(day: DayActivity): number {
  return Object.values(day.costByAgent).reduce((sum, value) => sum + value, 0);
}

function isNearLimit(budget: SystemStatus["budget"] | null): boolean {
  return budget !== null && budget.dailyLimitUsd > 0 && budget.spentTodayUsd >= budget.dailyLimitUsd * WARN_AT;
}

function Tile({ label, value, note, alert = false }: { label: string; value: string; note?: string; alert?: boolean }) {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value${alert ? " result-error" : ""}`}>{value}</strong>
      {note && <span className="muted">{note}</span>}
    </div>
  );
}

import { StatTile } from "@/components/StatTile";
import { average, formatUsd } from "@/lib/format";
import type { DayActivity } from "@/models/DayActivity";

interface AgentsBandProps {
  days: DayActivity[];
  /** The budget day running now; null when the period has no day. */
  today: DayActivity | null;
  periodLabel: string;
  held: number;
  stuck: number;
}

// The period's totals, today's spend and what waits on the user, in one row of tiles. Only failures and budget stops
// take a colour, not the total that includes them (user, 2026-10-18).
export function AgentsBand({ days, today, periodLabel, held, stuck }: AgentsBandProps) {
  const cost = days.reduce((sum, day) => sum + dayCost(day), 0);
  const runs = days.reduce((sum, day) => sum + day.runs, 0);
  const failures = days.reduce((sum, day) => sum + day.failures, 0);
  const budgetStops = days.reduce((sum, day) => sum + day.budgetStops, 0);
  const waiting = held + stuck;

  return (
    <div className="band">
      <StatTile label={`Spent, ${periodLabel}`} value={formatUsd(cost)} note={`${formatUsd(average(cost, days.length))} a day on average`} />
      <StatTile label={`Runs, ${periodLabel}`} value={String(runs)} note={<RunsNote failures={failures} budgetStops={budgetStops} />} />
      <StatTile label="Spent today" value={formatUsd(today ? dayCost(today) : 0)} note={`${today?.runs ?? 0} runs so far`} />
      <StatTile label="Waiting on you" value={String(waiting)} note={`${held} held · ${stuck} stuck`} tone={waiting > 0 ? "warn" : "plain"} />
    </div>
  );
}

function RunsNote({ failures, budgetStops }: { failures: number; budgetStops: number }) {
  return (
    <>
      <span className={failures > 0 ? "text-error" : undefined}>{failures} failed</span>
      {" · "}
      <span className={budgetStops > 0 ? "text-warn" : undefined}>{budgetStops} over budget</span>
    </>
  );
}

function dayCost(day: DayActivity): number {
  return Object.values(day.costByAgent).reduce((sum, value) => sum + value, 0);
}

import type { AgentDefinition } from "@agenttools/config";
import { StackedColumns } from "@/components/charts/StackedColumns";
import { formatUsd } from "@/lib/format";
import type { ChartSeries } from "@/models/ChartSeries";
import type { DayActivity } from "@/models/DayActivity";

const SERIES_SLOTS = 8;

// Cost per day stacked by agent, and runs per day with the failed part. An agent's color is its slot in the config's
// order, so it keeps its color whatever the period shows; agents past the palette fold into "Other".
export function ActivityCharts({ days, agents }: { days: DayActivity[]; agents: AgentDefinition[] }) {
  const labels = days.map((day) => day.day);
  const runs: ChartSeries[] = [
    { key: "ok", label: "Succeeded", color: "var(--series-1)", values: days.map((day) => day.runs - day.failures) },
    { key: "failed", label: "Failed", color: "var(--status-critical)", values: days.map((day) => day.failures) },
  ];

  return (
    <div className="dashboard-charts">
      <StackedColumns title="Cost per day" labels={labels} series={costSeries(days, agents)} format={formatUsd} axisLabel={dayOfMonth} />
      <StackedColumns title="Runs per day" labels={labels} series={runs} format={String} axisLabel={dayOfMonth} />
    </div>
  );
}

function costSeries(days: DayActivity[], agents: AgentDefinition[]): ChartSeries[] {
  const named = agents.slice(0, SERIES_SLOTS).map((agent, slot) => ({
    key: agent.id,
    label: agent.label,
    color: `var(--series-${slot + 1})`,
    values: days.map((day) => day.costByAgent[agent.id] ?? 0),
  }));
  const namedIds = new Set(named.map((series) => series.key));
  const other = days.map((day) => costOfOthers(day, namedIds));
  const shown = named.filter((series) => series.values.some((value) => value > 0));

  return other.some((value) => value > 0) ? [...shown, { key: "other", label: "Other", color: "var(--muted)", values: other }] : shown;
}

function costOfOthers(day: DayActivity, namedIds: Set<string>): number {
  return Object.entries(day.costByAgent).filter(([id]) => !namedIds.has(id)).reduce((sum, [, value]) => sum + value, 0);
}

function dayOfMonth(day: string): string {
  return String(Number(day.slice(8, 10)));
}

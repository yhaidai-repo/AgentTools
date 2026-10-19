import type { AgentDefinition } from "@agenttools/config";
import { StackedColumns } from "@/components/charts/StackedColumns";
import { SegLinks } from "@/components/SegLinks";
import { AGENT_COLOR_SLOTS, agentColor, OTHER_AGENTS_COLOR } from "@/lib/agentColors";
import { AGENT_METRICS, agentMetricOptions } from "@/lib/agentMetrics";
import { formatDayOfMonth } from "@/lib/format";
import type { AgentMetric } from "@/models/AgentMetric";
import type { ChartSeries } from "@/models/ChartSeries";
import type { DayActivity } from "@/models/DayActivity";

interface ActivityChartsProps {
  days: DayActivity[];
  agents: AgentDefinition[];
  /** The stacked chart's view: cost, tokens or duration (user request 2026-10-18). */
  metric: string;
  /** The URL parameters the metric switch keeps (the tab, the period). */
  keep: Record<string, string>;
}

// Cost, tokens or run time per day stacked by agent, and runs per day with the budget stops and the failed part apart.
// An agent's color is its slot in the config's order, so it keeps its color whatever the period shows; agents past the
// palette fold into "Other".
export function ActivityCharts({ days, agents, metric, keep }: ActivityChartsProps) {
  const labels = days.map((day) => day.day);
  const chosen = AGENT_METRICS[metric];
  const runs: ChartSeries[] = [
    { key: "ok", label: "Succeeded", color: "var(--accent)", values: days.map((day) => day.runs - day.failures - day.budgetStops) },
    { key: "budget", label: "Over budget", color: "var(--warn)", values: days.map((day) => day.budgetStops) },
    { key: "failed", label: "Failed", color: "var(--error)", values: days.map((day) => day.failures) },
  ];
  const metricSwitch = <SegLinks name="metric" value={metric} options={agentMetricOptions()} path="/dashboard" keep={keep} small />;

  return (
    <div className="grid two">
      <StackedColumns title={chosen.title} aside={metricSwitch} labels={labels} series={agentSeries(days, agents, chosen)} format={chosen.format} axisLabel={formatDayOfMonth} />
      <StackedColumns title="Runs per day" labels={labels} series={runs} format={String} axisLabel={formatDayOfMonth} />
    </div>
  );
}

function agentSeries(days: DayActivity[], agents: AgentDefinition[], metric: AgentMetric): ChartSeries[] {
  const named = agents.slice(0, AGENT_COLOR_SLOTS).map((agent, slot) => ({
    key: agent.id,
    label: agent.label,
    color: agentColor(slot),
    values: days.map((day) => metric.byAgent(day)[agent.id] ?? 0),
  }));
  const namedIds = new Set(named.map((series) => series.key));
  const other = days.map((day) => sumOfOthers(metric.byAgent(day), namedIds));
  const shown = named.filter((series) => series.values.some((value) => value > 0));

  return other.some((value) => value > 0) ? [...shown, { key: "other", label: "Other", color: OTHER_AGENTS_COLOR, values: other }] : shown;
}

function sumOfOthers(byAgent: Record<string, number>, namedIds: Set<string>): number {
  return Object.entries(byAgent).filter(([id]) => !namedIds.has(id)).reduce((sum, [, value]) => sum + value, 0);
}

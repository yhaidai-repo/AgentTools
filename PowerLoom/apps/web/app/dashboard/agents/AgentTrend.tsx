import { StackedColumns } from "@/components/charts/StackedColumns";
import { formatDayOfMonth } from "@/lib/format";
import type { AgentDay } from "@/models/AgentDay";
import type { AgentMetric } from "@/models/AgentMetric";

interface AgentTrendProps {
  days: AgentDay[];
  metric: AgentMetric;
  /** The agent's name, or "All agents". */
  label: string;
  color: string;
}

// The chosen agent's cost, duration per run or runs per day; one series, so the title names it and no legend is needed.
export function AgentTrend({ days, metric, label, color }: AgentTrendProps) {
  const series = [{ key: "metric", label: metric.label, color, values: days.map(metric.value) }];

  return <StackedColumns title={`${metric.label} per day · ${label}`} labels={days.map((day) => day.day)} series={series} format={metric.format} axisLabel={formatDayOfMonth} />;
}

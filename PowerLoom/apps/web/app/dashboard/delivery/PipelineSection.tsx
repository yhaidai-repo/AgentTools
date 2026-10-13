import { StackedColumns } from "@/components/charts/StackedColumns";
import type { ChartSeries } from "@/models/ChartSeries";
import type { StatusDwell } from "@/models/StatusDwell";
import type { WeekThroughput } from "@/models/WeekThroughput";
import { StatusTimeTable } from "./StatusTimeTable";

const STATUS_LABELS: Record<string, string> = { "ready-for-dev": "Ready for dev", done: "Done" };

interface PipelineSectionProps {
  throughput: WeekThroughput[];
  statuses: string[];
  dwell: StatusDwell[];
}

// PBIs reaching the pipeline's milestones per week, and how long PBIs sit in each status.
export function PipelineSection({ throughput, statuses, dwell }: PipelineSectionProps) {
  const series: ChartSeries[] = statuses.map((status, slot) => ({
    key: status,
    label: STATUS_LABELS[status] ?? status,
    color: status === "done" ? "var(--series-6)" : `var(--series-${slot + 1})`,
    values: throughput.map((week) => week.byStatus[status] ?? 0),
  }));

  return (
    <div className="dashboard-charts">
      <StackedColumns title="PBIs reaching a status, per week" labels={throughput.map((week) => week.week)} series={series} format={String} axisLabel={weekLabel} />
      <StatusTimeTable dwell={dwell} />
    </div>
  );
}

// The Monday as day.month.
function weekLabel(week: string): string {
  return `${Number(week.slice(8, 10))}.${Number(week.slice(5, 7))}`;
}

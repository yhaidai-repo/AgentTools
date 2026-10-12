import { StackedColumns } from "@/components/charts/StackedColumns";
import type { ChartSeries } from "@/models/ChartSeries";
import type { StatusDwell } from "@/models/StatusDwell";
import type { WeekThroughput } from "@/models/WeekThroughput";

const STATUS_LABELS: Record<string, string> = { "ready-for-dev": "Ready for dev", done: "Done" };

interface PipelineSectionProps {
  throughput: WeekThroughput[];
  statuses: string[];
  dwell: StatusDwell[];
}

// PBIs reaching the pipeline's milestones per week, and how long PBIs sit in each status (the slowest p95 is the
// bottleneck).
export function PipelineSection({ throughput, statuses, dwell }: PipelineSectionProps) {
  const series: ChartSeries[] = statuses.map((status, slot) => ({
    key: status,
    label: STATUS_LABELS[status] ?? status,
    color: status === "done" ? "var(--series-6)" : `var(--series-${slot + 1})`,
    values: throughput.map((week) => week.byStatus[status] ?? 0),
  }));
  const slowest = Math.max(...dwell.map((row) => row.p95Hours), 0);

  return (
    <div className="dashboard-charts">
      <StackedColumns title="PBIs reaching a status, per week" labels={throughput.map((week) => week.week)} series={series} format={String} axisLabel={weekLabel} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Left it</th>
              <th>Avg hours</th>
              <th>p95 hours</th>
            </tr>
          </thead>
          <tbody>
            {dwell.map((row) => (
              <tr key={row.status}>
                <td>{row.status}</td>
                <td>{row.transitions}</td>
                <td>{row.averageHours.toFixed(1)}</td>
                <td className={row.p95Hours === slowest && slowest > 0 ? "result-error" : undefined}>{row.p95Hours.toFixed(1)}</td>
              </tr>
            ))}
            {dwell.length === 0 && <tr><td colSpan={4} className="muted">No status changes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The Monday as day.month.
function weekLabel(week: string): string {
  return `${Number(week.slice(8, 10))}.${Number(week.slice(5, 7))}`;
}

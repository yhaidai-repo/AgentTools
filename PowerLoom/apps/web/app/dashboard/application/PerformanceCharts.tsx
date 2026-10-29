import { Panel } from "@/components/Panel";
import { TimeSeries } from "@/components/charts/TimeSeries";
import type { PerformanceHistory } from "@/lib/applicationPerformance";

export function PerformanceCharts({ history }: { history: PerformanceHistory | null }) {
  const points = history?.points ?? [];
  const measured = points.some(point => point.observedMinutes > 0);
  const series = (field: "requestsPerMinute" | "averageLatencyMs" | "workingSetBytes", divisor = 1) => points.map(point => ({ at: point.at, value: point[field] == null ? null : point[field] / divisor, observedMinutes: point.observedMinutes }));
  const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });

  return <>
    <div className="section-label">Application performance</div>
    <p className="performance-hint">Backend API · last 24 hours · five-minute intervals · UTC. Gaps mean no observations. Memory shows the highest sampled process use in each interval.</p>
    {history === null ? <Panel tone="error"><p className="text-error">Performance history is unavailable.</p></Panel>
      : !measured ? <Panel><p>Collecting performance data. Charts appear after the first minute.</p></Panel>
      : <div className="grid three">
        <TimeSeries title="Requests per minute" points={series("requestsPerMinute")} format={value => `${number(value)}/min`} color="var(--series-7)" />
        <TimeSeries title="Average response time" points={series("averageLatencyMs")} format={value => `${number(value)} ms`} color="var(--series-6)" />
        <TimeSeries title="Memory use" points={series("workingSetBytes", 1048576)} format={value => `${number(value)} MiB`} color="var(--series-3)" />
      </div>}
  </>;
}

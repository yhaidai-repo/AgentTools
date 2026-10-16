import { formatHours } from "@/lib/format";
import type { StatusDwell } from "@/models/StatusDwell";

// How long PBIs sit in each pipeline status (the slowest p95 is the bottleneck).
export function PipelineSection({ dwell }: { dwell: StatusDwell[] }) {
  const slowest = Math.max(...dwell.map((row) => row.p95Hours), 0);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th title="How many times a PBI moved on from this status">Times left</th>
            <th title="Average time a PBI stayed in this status">Average stay</th>
            <th title="95 of 100 stays were shorter than this (p95); the slowest status is red">95% left within</th>
          </tr>
        </thead>
        <tbody>
          {dwell.map((row) => (
            <tr key={row.status}>
              <td>{row.status}</td>
              <td>{row.transitions}</td>
              <td>{formatHours(row.averageHours)}</td>
              <td className={row.p95Hours === slowest && slowest > 0 ? "result-error" : undefined}>{formatHours(row.p95Hours)}</td>
            </tr>
          ))}
          {dwell.length === 0 && <tr><td colSpan={4} className="muted">No status changes yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

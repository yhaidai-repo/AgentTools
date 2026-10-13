import { formatHours } from "@/lib/format";
import { pipelineStatusInfo } from "@/lib/pipelineStatusInfo";
import type { StatusDwell } from "@/models/StatusDwell";

const WHO_LABELS: Record<string, string> = { agent: "agent working", queue: "agent queue", you: "you", "–": "–" };

// How long PBIs stay in each pipeline step, in plain words (user request 2026-10-13: make the table understandable),
// and who is in each step right now. The slowest step (by the slowest 5% of stays) is marked as the bottleneck.
export function StatusTimeTable({ dwell }: { dwell: StatusDwell[] }) {
  const slowest = Math.max(...dwell.map((row) => row.p95Hours), 0);

  return (
    <div className="table-wrap">
      <h3>Time in each pipeline step</h3>
      <p className="muted">
        How long a PBI stays in a step before it moves on. <b>Usual stay</b> is the average; <b>slow stays</b>: 95 of 100
        stays were shorter (p95). <b>Passed</b> counts every exit (a PBI can pass a step twice). <b>Now</b> shows the PBIs in
        the step today and the longest one has waited so far.
      </p>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Who acts</th>
            <th>Passed</th>
            <th>Usual stay</th>
            <th>Slow stays up to</th>
            <th>Now</th>
          </tr>
        </thead>
        <tbody>
          {dwell.map((row) => <StatusRow key={row.status} row={row} isBottleneck={row.p95Hours === slowest && slowest > 0} />)}
          {dwell.length === 0 && <tr><td colSpan={6} className="muted">No status changes yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatusRow({ row, isBottleneck }: { row: StatusDwell; isBottleneck: boolean }) {
  const info = pipelineStatusInfo(row.status);

  return (
    <tr>
      <td>{info.label}<br /><span className="muted">{info.meaning}</span></td>
      <td>{WHO_LABELS[info.who]}</td>
      <td>{row.transitions}</td>
      <td>{row.transitions > 0 ? formatHours(row.averageHours) : "–"}</td>
      <td className={isBottleneck ? "result-error" : undefined}>{row.transitions > 0 ? formatHours(row.p95Hours) : "–"}{isBottleneck && " (slowest step)"}</td>
      <td>{row.inStatusNow > 0 ? `${row.inStatusNow}${longestWait(row)}` : "–"}</td>
    </tr>
  );
}

function longestWait(row: StatusDwell): string {
  return row.longestWaitHours === null ? "" : `, longest ${formatHours(row.longestWaitHours)}`;
}

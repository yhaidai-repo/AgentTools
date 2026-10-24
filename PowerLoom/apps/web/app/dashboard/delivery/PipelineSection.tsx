import { Panel } from "@/components/Panel";
import { formatHours } from "@/lib/format";
import type { StatusDwell } from "@/models/StatusDwell";

// The log scale runs from one minute to this many hours (about 14 days): stays from minutes to days fit one axis.
const SCALE_MAX_HOURS = 333;
const MINUTE_HOURS = 1 / 60;

// How long the vault's PBIs sit in each pipeline status: the median stay as a glowing bar and the p95 as a tick, on a
// log scale; every bar the same colour, the lengths show where time goes (user decision 2026-10-18: no amber, a slow
// status isn't a fault).
export function PipelineSection({ dwell }: { dwell: StatusDwell[] }) {
  if (dwell.length === 0) {
    return <Panel><p className="empty">No status changes yet.</p></Panel>;
  }

  return (
    <Panel>
      <div className="pipe">
        {dwell.map((row) => <PipelineRow key={row.status} row={row} />)}
      </div>
      <div className="legend">
        <span><span className="swatch" style={{ background: "var(--accent)" }} />Median stay</span>
        <span><span className="legend-tick" />95% leave within</span>
        <span className="text-faint">Log scale</span>
      </div>
    </Panel>
  );
}

function PipelineRow({ row }: { row: StatusDwell }) {
  const median = position(row.medianHours);
  const p95 = position(row.p95Hours);

  return (
    <>
      <span>{statusLabel(row.status)}</span>
      <span className="pipe-track" title={`${row.transitions} stays`}>
        <span className="pipe-axis" />
        <span className="pipe-span" style={{ left: `${median}%`, width: `${Math.max(p95 - median, 0)}%` }} />
        <span className="pipe-bar" style={{ width: `${median}%` }} />
        <span className="pipe-p95" style={{ left: `${p95}%` }} />
      </span>
      <span className="pipe-time"><b>{formatHours(row.medianHours)}</b> · {formatHours(row.p95Hours)}</span>
    </>
  );
}

// Where a stay falls on the log axis, as a percent of its width; a stay under a minute sits at the start.
function position(hours: number): number {
  const minutes = Math.max(hours, MINUTE_HOURS) / MINUTE_HOURS;
  const scaleMinutes = SCALE_MAX_HOURS / MINUTE_HOURS;

  return Math.min(Math.max((Math.log10(minutes) / Math.log10(scaleMinutes)) * 100, 1), 100);
}

// ready-for-refinement → Ready for refinement.
function statusLabel(status: string): string {
  const words = status.replaceAll("-", " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}

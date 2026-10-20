import type { PipelineStatus } from "@powerloom/core";
import { formatHours } from "@/lib/format";
import type { MetroStation } from "@/models/MetroStation";

const PAUSES: Partial<Record<PipelineStatus, string>> = { "waiting-human": "waiting on you", stale: "stale", closed: "closed" };

interface PipelineMetroProps {
  stations: MetroStation[];
  status: PipelineStatus;
  /** An agent works on the PBI right now: the current station pulses faster. */
  running: boolean;
}

// The PBI's way through the pipeline as metro stations (user request 2026-10-18): passed stations glow, a skipped one
// is dashed, the current one rings; under each, how long the PBI stayed, or its runs when only a task of it ran. A pause (waiting on you, stale, closed) shows
// at the station where the PBI stopped.
export function PipelineMetro({ stations, status, running }: PipelineMetroProps) {
  const here = stations.findIndex((station) => station.state === "current");
  const pause = PAUSES[status] ?? null;

  return (
    <div className={`metro${running ? " running" : ""}`} style={{ gridTemplateColumns: `repeat(${stations.length}, 1fr)` }}>
      <span className="metro-track" />
      <span className="metro-done" style={{ width: `calc(100% / ${stations.length} * ${here})` }} />
      {stations.map((station) => <Station key={station.key} station={station} pause={station.state === "current" ? pause : null} />)}
    </div>
  );
}

function Station({ station, pause }: { station: MetroStation; pause: string | null }) {
  return (
    <div className={`station ${station.state}${pause ? " paused" : ""}`}>
      <span className="station-dot" />
      <span className="station-name">{station.name}</span>
      <span className="station-time">{stationTime(station)}</span>
      {pause && <span className="station-pause">{pause}</span>}
    </div>
  );
}

function stationTime(station: MetroStation): string {
  if (station.state === "skipped") {
    return "skipped";
  }

  if (station.hours !== null) {
    return formatHours(station.hours);
  }

  return station.runs > 0 ? runsText(station.runs) : "";
}

function runsText(runs: number): string {
  return runs === 1 ? "1 run" : `${runs} runs`;
}

import Link from "next/link";
import { TimeAgo } from "@/components/TimeAgo";
import type { SystemStatus } from "@/lib/systemStatus";

// Claimed tasks past their agent's timeout (and PowerLoom's margin): the run may hang, or the runner died with it.
export function StuckRuns({ runs }: { runs: SystemStatus["runs"] }) {
  if (runs.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <>
      {runs.map((run) => (
        <p key={run.taskId} className="dashboard-row">
          <span className="state-dot state-degraded" />
          <strong>{run.taskId}</strong> <span className="muted">{run.agentId}{run.pbiId ? <> · <Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link></> : null} · since <TimeAgo date={new Date(run.since)} /></span>
        </p>
      ))}
    </>
  );
}

import Link from "next/link";
import { Panel } from "@/components/Panel";
import { StatusRow } from "@/components/StatusRow";
import { TimeAgo } from "@/components/TimeAgo";
import type { SystemStatus } from "@/lib/systemStatus";

// The vault's claimed tasks running now; one past its agent's timeout (and PowerLoom's margin) is stuck: the run may
// hang, or the runner died with it.
export function RunsInProgress({ runs }: { runs: SystemStatus["runs"] }) {
  const stuck = runs.some((run) => run.stuck);

  return (
    <Panel title="Runs in progress" tone={stuck ? "warn" : "plain"}>
      {runs.length === 0 && <p className="empty">None.</p>}
      {runs.map((run) => (
        <StatusRow
          key={run.taskId}
          name={<>{run.taskId} <span className="text-faint">{run.agentId}{run.pbiId ? <> · <Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link></> : null}</span></>}
          value={<>{run.stuck ? "stuck · " : ""}<TimeAgo date={run.since} /></>}
          tone={run.stuck ? "warn" : "good"}
        />
      ))}
    </Panel>
  );
}

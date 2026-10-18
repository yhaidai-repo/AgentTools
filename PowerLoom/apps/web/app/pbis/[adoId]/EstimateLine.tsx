import Link from "next/link";
import type { pbiEstimate } from "@powerloom/db";

type EstimateRow = typeof pbiEstimate.$inferSelect;

// One agent estimate (record_estimate): both values first, then who gave it and why. A refinement estimate from before
// record_estimate has no agent hours.
export function EstimateLine({ estimate }: { estimate: EstimateRow }) {
  return (
    <>
      <p>
        <strong>{Number(estimate.humanHours)} h human</strong> · <strong>{estimate.agentHours === null ? "agent h not given" : `${Number(estimate.agentHours)} h agent`}</strong>
        {estimate.complexity !== null && <> · complexity {estimate.complexity}/5</>}
        {estimate.confidence !== null && <> · confidence {estimate.confidence}</>}
        {" "}<span className="muted">({estimate.agent}{estimate.runId ? <>, <Link href={`/agents/runs/${estimate.runId}`}>RUN-{estimate.runId}</Link></> : null})</span>
      </p>
      {estimate.basis && <p className="muted">Basis: {estimate.basis}</p>}
    </>
  );
}

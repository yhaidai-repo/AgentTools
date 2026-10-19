import Link from "next/link";
import { AgentTag } from "@/components/AgentTag";
import { TimeAgo } from "@/components/TimeAgo";
import type { DataAccessRow } from "@/lib/toolUsage";

// Each call as one line (when, agent, tool and resource, outcome, time, run); the request as sent opens under it and
// wraps instead of widening the page (user decision 2026-10-18).
export function CallRows({ rows, palette }: { rows: DataAccessRow[]; palette: string[] }) {
  if (rows.length === 0) {
    return <p className="hint">No calls in the period.</p>;
  }

  return (
    <div className="call-rows">
      {rows.map((row) => (
        <details key={row.id} className="call-row">
          <summary>
            <span className="call-when"><TimeAgo date={row.startedAt} /></span>
            <AgentTag agent={row.agentId} palette={palette} />
            <span className="call-tool">{row.tool}{row.resource && row.resource !== row.tool ? ` · ${row.resource}` : ""}</span>
            <span className={row.outcome === "ok" ? "call-outcome" : "call-outcome text-error"}><span className={row.outcome === "ok" ? "dot ok" : "dot error"} />{row.outcome}{row.rows !== null ? ` · ${row.rows} rows${row.truncated ? " (cut)" : ""}` : ""}</span>
            <span className="call-ms">{row.durationMs} ms</span>
            {row.runId === null ? <span className="muted">chat</span> : <Link href={`/agents/runs/${row.runId}`}>RUN-{row.runId}</Link>}
          </summary>
          {row.reason && <p className="call-reason text-error">{row.reason}</p>}
          <pre className="call-request">{row.request}</pre>
        </details>
      ))}
    </div>
  );
}

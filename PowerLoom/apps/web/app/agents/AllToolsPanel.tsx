import { Fragment } from "react";
import { AgentDots } from "@/components/AgentDots";
import { TimeAgo } from "@/components/TimeAgo";
import type { ToolCatalogRow } from "@/lib/toolUsage";

// Every tool the agents' latest runs and the latest chat were given, used or not (user request 2026-10-25), grouped by
// what gives it: every agent, a grant on the Config page, the skills, the PowerLoom commands. A tool of a grant no agent
// has appears once an agent with it has run.
export function AllToolsPanel({ rows, palette }: { rows: ToolCatalogRow[]; palette: string[] }) {
  return (
    <details className="panel fold-panel">
      <summary>
        <span className="fold-mark" aria-hidden="true">›</span>All tools<small>what each agent&apos;s latest run and the latest chat were given, used or not</small>
        <span className="fold-count">{rows.length}</span>
      </summary>
      <ToolTable rows={rows} palette={palette} />
    </details>
  );
}

function ToolTable({ rows, palette }: { rows: ToolCatalogRow[]; palette: string[] }) {
  if (rows.length === 0) {
    return <p className="panel-body hint">No run or chat has recorded its tools yet: they appear after the next run.</p>;
  }

  const sources = [...new Set(rows.map((row) => row.source))];

  return (
    <table className="data-table vault-table tools-table">
      <thead>
        <tr><th>Tool</th><th className="col-uses">Calls</th><th className="col-agents">Has it</th><th className="col-when num">Last used</th></tr>
      </thead>
      <tbody>
        {sources.map((source) => (
          <Fragment key={source}>
            <tr className="tool-group-row"><th colSpan={4}>{source}</th></tr>
            {rows.filter((row) => row.source === source).map((row) => <ToolRow key={row.name} row={row} palette={palette} />)}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function ToolRow({ row, palette }: { row: ToolCatalogRow; palette: string[] }) {
  return (
    <tr>
      <td className="title"><span className="mono resource-name">{row.name}</span><span className="note-path">{row.summary}</span></td>
      <td className="col-uses">{row.calls > 0 ? <span>{row.calls}{row.failed > 0 && <span className="muted"> · {row.failed} not ok</span>}</span> : <span className="muted">0</span>}</td>
      <td className="col-agents"><AgentDots agents={row.holders} palette={palette} /></td>
      <td className="col-when num">{row.lastUsed ? <TimeAgo date={row.lastUsed} /> : <span className="muted">never</span>}</td>
    </tr>
  );
}

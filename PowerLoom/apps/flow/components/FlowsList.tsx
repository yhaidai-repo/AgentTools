"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteFlowAction } from "@/app/actions";
import { formatTime } from "@/lib/format";
import type { FlowSummary } from "@/lib/views";
import { RunDialog } from "./RunDialog";
import { StatusBadge } from "./StatusBadge";

// The vault's saved flows (PowerLoom's `flow` table): run one, open it, delete it, start a new one.
export function FlowsList({ flows }: { flows: FlowSummary[] }) {
  const router = useRouter();
  const [running, setRunning] = useState<FlowSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (flow: FlowSummary) => {
    if (!window.confirm(`Delete flow "${flow.name}" and its finished executions?`)) return;

    const outcome = await deleteFlowAction(flow.id);

    if (outcome.ok) {
      setError(null);
      router.refresh();
    } else {
      setError(outcome.error);
    }
  };

  return (
    <>
      <div className="flows-head">
        <h1>Flows</h1>
        <Link href="/flows/new"><button type="button">New flow</button></Link>
      </div>
      {error && <div className="problems">{error}</div>}
      {flows.length === 0 ? (
        <div className="card empty">No flows in this vault yet. New flow opens the editor with the trigger node and the agents of this PowerLoom.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Nodes</th>
                <th>Updated</th>
                <th>Last execution</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td className="title"><Link href={`/flows/${encodeURIComponent(flow.id)}`}>{flow.name}</Link><br /><code className="muted">{flow.id}</code></td>
                  <td className="muted">v{flow.version}</td>
                  <td className="muted">{flow.agents} agent{flow.agents === 1 ? "" : "s"}, {flow.edges} edge{flow.edges === 1 ? "" : "s"}</td>
                  <td className="muted">{formatTime(flow.updatedAt)}</td>
                  <td>
                    {flow.lastExecution
                      ? <Link href={`/executions/${encodeURIComponent(flow.lastExecution.id)}`} className="exec-link"><StatusBadge tone={flow.lastExecution.status} /> <span className="muted">{formatTime(flow.lastExecution.startedAt)}</span></Link>
                      : <span className="faint">never run</span>}
                  </td>
                  <td className="actions">
                    <button type="button" className="small" onClick={() => setRunning(flow)} disabled={flow.agents === 0}>Run</button>
                    <Link href={`/flows/${encodeURIComponent(flow.id)}`}><button type="button" className="secondary small">Open</button></Link>
                    <button type="button" className="danger small" onClick={() => remove(flow)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {running && <RunDialog flowId={running.id} flowName={running.name} onClose={() => setRunning(null)} />}
    </>
  );
}

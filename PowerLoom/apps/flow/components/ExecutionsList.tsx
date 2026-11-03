"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearExecutions, listExecutions, onExecutionsChange } from "@/lib/executionStore";
import { formatTime } from "@/lib/format";
import type { ExecutionRecord } from "@/models/ExecutionRecord";
import { StatusBadge } from "./StatusBadge";

// The mocked executions of this browser session, newest first; one chip per agent node with its runs.
export function ExecutionsList() {
  const [executions, setExecutions] = useState<ExecutionRecord[] | null>(null);

  useEffect(() => {
    const refresh = () => setExecutions(listExecutions());

    refresh();

    return onExecutionsChange(refresh);
  }, []);

  return (
    <>
      <div className="flows-head">
        <h1>Executions</h1>
        {executions && executions.length > 0 && <button type="button" className="secondary" onClick={clearExecutions}>Clear</button>}
      </div>
      <p className="muted">Mocked (phase 0): nothing reached PowerLoom. The list lives in this browser tab&apos;s session.</p>
      {executions === null ? (
        <p className="muted">Loading…</p>
      ) : executions.length === 0 ? (
        <div className="card empty">No executions yet. Open a flow and press Run (mock).</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flow</th>
                <th>Status</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Nodes</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td className="title"><Link href={`/flows/${execution.flowId}`}>{execution.flowName}</Link><br /><code className="muted">{execution.id}</code></td>
                  <td><StatusBadge status={execution.status} /></td>
                  <td className="muted">{formatTime(execution.startedAt)}</td>
                  <td className="muted">{formatTime(execution.finishedAt)}</td>
                  <td>
                    <div className="exec-nodes">
                      {execution.nodes.map((node) => (
                        <span key={node.nodeId} className={`exec-node ${node.status}`} title={node.title}>
                          <span className="id">{node.agentId}</span>
                          <span>{node.kind}</span>
                          <span className="runs">{node.runsDone}/{node.runs}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";
import { progressPercent } from "@/lib/stepLooks";
import type { ExecutionView } from "@/lib/views";
import { StatusBadge } from "./StatusBadge";

// The vault's executions, newest first, one flow or all of them: status, progress (done steps over the steps the
// execution reaches) and the target in the web app.
export function ExecutionsList({ executions, flows, flowId }: { executions: ExecutionView[]; flows: { id: string; name: string }[]; flowId: string | null }) {
  const router = useRouter();

  return (
    <>
      <div className="flows-head">
        <h1>Executions</h1>
        <label className="inline">
          Flow
          <select value={flowId ?? ""} onChange={(event) => router.push(event.target.value ? `/executions?flow=${encodeURIComponent(event.target.value)}` : "/executions")}>
            <option value="">all flows</option>
            {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
          </select>
        </label>
      </div>
      {executions.length === 0 ? (
        <div className="card empty">No executions yet. Run a flow from the Flows page or its editor.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Execution</th>
                <th>Flow</th>
                <th>Target</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Started</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td><Link href={`/executions/${encodeURIComponent(execution.id)}`}><code>{execution.id}</code></Link></td>
                  <td className="title"><Link href={`/flows/${encodeURIComponent(execution.flowId)}`}>{execution.flowName}</Link> <span className="faint">v{execution.flowVersion}</span></td>
                  <td><a href={execution.target.url} target="_blank" rel="noreferrer">{execution.target.label} ↗</a></td>
                  <td><StatusBadge tone={execution.status} /></td>
                  <td>
                    <div className="progress-cell" title={`${execution.progress.done} of ${execution.progress.total} steps done`}>
                      <div className={`progress${execution.status === "done" ? " done" : ""}`}><span style={{ width: `${progressPercent(execution.progress)}%` }} /></div>
                      <span className="muted">{execution.progress.done} / {execution.progress.total}</span>
                    </div>
                  </td>
                  <td className="muted">{formatTime(execution.startedAt)}</td>
                  <td className="muted">{formatTime(execution.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

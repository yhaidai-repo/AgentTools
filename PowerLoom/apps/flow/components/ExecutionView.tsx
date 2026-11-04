"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cancelExecutionAction } from "@/app/actions";
import { formatTime } from "@/lib/format";
import { progressPercent, stepTone } from "@/lib/stepLooks";
import type { ExecutionView as View, StepView } from "@/lib/views";
import type { FlowAgent } from "@/models/FlowAgent";
import { ExecutionCanvas } from "./ExecutionCanvas";
import { StatusBadge } from "./StatusBadge";

const POLL_MS = 3000;

// One execution: the flow's canvas coloured by the steps, the step table with the links into the web app, Cancel while
// it runs. While running, the page asks /api/executions/<id> every three seconds (quiet while the tab is hidden).
export function ExecutionView({ initial, agents }: { initial: View; agents: FlowAgent[] }) {
  const router = useRouter();
  const [execution, setExecution] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = execution.status === "running";

  useEffect(() => setExecution(initial), [initial]);

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;

      const fresh = await fetchExecution(execution.id);

      if (fresh) setExecution(fresh);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [running, execution.id]);

  const cancel = async () => {
    if (!window.confirm(`Cancel execution ${execution.id}? Tasks it already created stay as they are.`)) return;
    setBusy(true);

    const outcome = await cancelExecutionAction(execution.id);

    if (outcome.ok) {
      setError(null);
      const fresh = await fetchExecution(execution.id);

      if (fresh) setExecution(fresh);
      router.refresh();
    } else {
      setError(outcome.error);
    }
    setBusy(false);
  };

  const percent = progressPercent(execution.progress);

  return (
    <div className="execution">
      <div className="editor-bar">
        <Link href="/executions" className="muted">← Executions</Link>
        <h1 className="exec-title"><code>{execution.id}</code></h1>
        <span className="muted">of <Link href={`/flows/${encodeURIComponent(execution.flowId)}`}>{execution.flowName}</Link> v{execution.flowVersion}</span>
        <span className="muted">for <a href={execution.target.url} target="_blank" rel="noreferrer">{execution.target.label} ↗</a></span>
        <StatusBadge tone={execution.status} />
        <span className="spacer" />
        {running && <button type="button" className="danger" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel"}</button>}
      </div>
      <div className="run-bar">
        <span className="text">{execution.progress.done} / {execution.progress.total} steps done</span>
        <div className={`progress${execution.status === "done" ? " done" : ""}`}><span style={{ width: `${percent}%` }} /></div>
        <span className="text">{percent}%</span>
        <span className="text">started {formatTime(execution.startedAt)}{execution.finishedAt ? `, finished ${formatTime(execution.finishedAt)}` : ""}</span>
        {running && <span className="text live">live</span>}
      </div>
      {execution.error && <div className="problems">{execution.error}</div>}
      {error && <div className="problems">{error}</div>}
      <ExecutionCanvas definition={execution.definition} steps={execution.steps} status={execution.status} agents={agents} />
      <StepTable steps={execution.steps} />
    </div>
  );
}

function StepTable({ steps }: { steps: StepView[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Node</th>
            <th>Agent</th>
            <th>Kind</th>
            <th>Task</th>
            <th>Status</th>
            <th>Runs</th>
            <th>Last run</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.nodeId}>
              <td><code>{step.nodeId}</code></td>
              <td><a href={step.agentUrl} target="_blank" rel="noreferrer">{step.agent}</a></td>
              <td><code>{step.kind}</code></td>
              <td>{step.itemId && step.taskUrl ? <a href={step.taskUrl} target="_blank" rel="noreferrer">{step.itemId} ↗</a> : <span className="faint">–</span>}</td>
              <td><StatusBadge tone={stepTone(step.status)} label={step.status} /></td>
              <td className="muted">{step.runs}</td>
              <td>{step.lastRunId !== null && step.runUrl ? <a href={step.runUrl} target="_blank" rel="noreferrer">RUN-{step.lastRunId} ↗</a> : <span className="faint">–</span>}</td>
              <td className="actions">{step.taskUrl && step.runs > 0 && <a href={step.taskUrl} target="_blank" rel="noreferrer" className="muted" title="Re-run or start over on the task's page in the web app">Re-run ↗</a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function fetchExecution(id: string): Promise<View | null> {
  try {
    const response = await fetch(`/api/executions/${encodeURIComponent(id)}`, { cache: "no-store" });

    return response.ok ? ((await response.json()) as View) : null;
  } catch {
    return null;
  }
}

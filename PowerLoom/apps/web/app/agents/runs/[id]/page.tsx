import { MAIN_SESSION_ID, loadRun, runSessionsOf, type RunSessionTrace } from "@powerloom/core";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NoVault } from "@/components/NoVault";
import { Panel } from "@/components/Panel";
import { getAgentConfig } from "@/lib/agentConfig";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { runEndPanel } from "@/lib/runOutcomes";
import { outputProducers } from "@/lib/sessionLooks";
import { getUsageStore } from "@/lib/usage";
import { RunHeader } from "./RunHeader";
import { RunFailureReports } from "./RunFailureReports";
import { RunCaptures, RunOutputs } from "./RunOutputs";
import { SessionTraceView } from "./SessionTraceView";
import { TraceView } from "./TraceView";

export const dynamic = "force-dynamic";

// Beyond this many events a run with sub-sessions sends the browser only its main session's events; the others load
// when opened. The server still reads the whole trace once to build the session tree.
const LARGE_TRACE_EVENTS = 1500;

// One run, like the other detail pages (user decision 2026-10-18): its header, the trace in the main column, and its
// outputs, failure and first message beside it. A run of another vault is not found: every page shows only the vault
// picked at the top. A run whose agent started sub-agents shows its trace by session (user decision 2026-10-28); one
// without looks as before.
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Agents" />;
  }

  const runId = Number((await params).id);
  const found = Number.isInteger(runId) ? await loadRun(getDb(), runId, vault) : null;

  if (!found) {
    notFound();
  }

  const { run, task } = found;
  const store = getUsageStore();
  const [usage] = await store.records({ from: new Date(0), match: { run: String(run.id) } }, 1);
  const trace = await store.trace(String(run.id));
  const palette = (await getAgentConfig().list()).map((agent) => agent.id);
  const sessions = runSessionsOf(trace, run.outcome !== "running");
  const hasSubSessions = sessions.sessions.length > 1;
  const isLarge = trace.length > LARGE_TRACE_EVENTS;
  const endPanel = runEndPanel(run.outcome);

  return (
    <>
      <AutoRefresh active={run.outcome === "running"} />
      <RunHeader run={run} task={task} usage={usage} palette={palette} />
      <div className="pbi-columns run-columns">
        <Panel title={<span>Trace <small>{trace.length} events</small></span>}>
          {hasSubSessions ? <SessionTraceView runId={run.id} sessions={sessions.sessions} events={isLarge ? mainEvents(sessions) : sessions.events} complete={!isLarge} continuesRunId={run.continuesRunId} /> : <TraceView events={trace} />}
        </Panel>
        <div>
          {endPanel && <section className={`panel run-end-panel${endPanel.tone ? ` tone-${endPanel.tone}` : ""}`}><h3>{endPanel.title} <small>{run.outcome}</small></h3><p className="panel-body">{run.error ?? "no message"}</p></section>}
          <Panel title="Outputs"><RunOutputs run={run} producers={hasSubSessions ? outputProducers(sessions, run.outputs ?? []) : {}} /></Panel>
          <RunCaptures runId={run.id} />
          <RunFailureReports runId={run.id} />
          <details className="panel fold-panel">
            <summary><span className="fold-mark" aria-hidden="true">›</span>Input <small>{run.continuesRunId ? "continuation note" : "first message"}</small></summary>
            <pre className="run-input">{run.input ?? "–"}</pre>
          </details>
        </div>
      </div>
    </>
  );
}

function mainEvents(sessions: RunSessionTrace): RunSessionTrace["events"] {
  return { [MAIN_SESSION_ID]: sessions.events[MAIN_SESSION_ID] };
}

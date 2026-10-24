import { isFailedOutcome, loadRun } from "@powerloom/core";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NoVault } from "@/components/NoVault";
import { Panel } from "@/components/Panel";
import { getAgentConfig } from "@/lib/agentConfig";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { getUsageStore } from "@/lib/usage";
import { RunHeader } from "./RunHeader";
import { RunCaptures, RunOutputs } from "./RunOutputs";
import { TraceView } from "./TraceView";

export const dynamic = "force-dynamic";

// One run, like the other detail pages (user decision 2026-10-18): its header, the trace in the main column, and its
// outputs, failure and first message beside it. A run of another vault is not found: every page shows only the vault
// picked at the top.
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

  return (
    <>
      <AutoRefresh active={run.outcome === "running"} />
      <RunHeader run={run} task={task} usage={usage} palette={palette} />
      <div className="pbi-columns run-columns">
        <Panel title={<span>Trace <small>{trace.length} events</small></span>}>
          <TraceView events={trace} />
        </Panel>
        <div>
          {isFailedOutcome(run.outcome) && <section className="panel tone-error failure-panel"><h3>Failure <small>{run.outcome}</small></h3><p className="panel-body">{run.error ?? "no message"}</p></section>}
          <Panel title="Outputs"><RunOutputs run={run} /></Panel>
          <RunCaptures runId={run.id} />
          <details className="panel fold-panel">
            <summary><span className="fold-mark" aria-hidden="true">›</span>Input <small>{run.continuesRunId ? "continuation note" : "first message"}</small></summary>
            <pre className="run-input">{run.input ?? "–"}</pre>
          </details>
        </div>
      </div>
    </>
  );
}

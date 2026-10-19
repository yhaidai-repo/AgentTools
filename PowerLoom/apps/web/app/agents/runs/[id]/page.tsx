import { isFailedOutcome } from "@powerloom/core";
import { agentRun, localItem, refinement, vaultCapture, workItem } from "@powerloom/db";
import type { StoredTraceEvent, UsageRecord } from "@agenttools/usage";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LocalTime } from "@/components/LocalTime";
import { NoteLink } from "@/components/NoteLink";
import { formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { itemPath } from "@/lib/items";
import { getUsageStore } from "@/lib/usage";
import { RunRerun } from "@/app/runs/RunRerun";
import { ConversationChips } from "./ConversationChips";
import { TraceView } from "./TraceView";

export const dynamic = "force-dynamic";

const FAILURE_CONTEXT_EVENTS = 5;

type RunRow = typeof agentRun.$inferSelect;

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const runId = Number((await params).id);
  const [run] = Number.isInteger(runId) ? await getDb().select().from(agentRun).where(eq(agentRun.id, runId)) : [];

  if (!run) {
    notFound();
  }

  const store = getUsageStore();
  const [usage] = await store.records({ from: new Date(0), match: { run: String(run.id) } }, 1);
  const trace = await store.trace(String(run.id));
  const [task] = run.itemId ? await getDb().select().from(localItem).where(eq(localItem.id, run.itemId)) : [];

  return (
    <>
      <h1>RUN-{run.id} · {run.stage}</h1>
      <p><Link href={`/runs?agent=${run.stage}`}>← {run.stage} runs</Link></p>
      <RunSummary run={run} usage={usage} />
      <p className="actions"><RunRerun task={task ?? null} /></p>
      <h2>Outputs</h2>
      <Outputs run={run} />
      <Captures runId={run.id} />
      {isFailedOutcome(run.outcome) && <Failure run={run} trace={trace} />}
      <h2>{run.continuesRunId ? "Input (continuation note)" : "Input (first message)"}</h2>
      <details>
        <summary>Show</summary>
        <pre>{run.input ?? "–"}</pre>
      </details>
      <h2>Trace ({trace.length} events)</h2>
      <TraceView events={trace} />
    </>
  );
}

function RunSummary({ run, usage }: { run: RunRow; usage?: UsageRecord }) {
  return (
    <div className="chips">
      <span className="chip">outcome: {run.outcome}</span>
      <AutoRefresh active={run.outcome === "running"} />
      {run.pbiId && <Link className="chip" href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link>}
      <span className="chip">model: {run.model}</span>
      <span className="chip">prompt: {run.promptVersion}</span>
      <span className="chip">started: <LocalTime date={run.startedAt} /></span>
      <ConversationChips run={run} />
      {usage && (
        <>
          <span className="chip">turns: {usage.turns}</span>
          <span className="chip">duration: {formatDuration(usage.durationMs)}</span>
          <span className="chip">in {formatTokens(usage.inputTokens)} · out {formatTokens(usage.outputTokens)} · cache r {formatTokens(usage.cacheReadTokens)} / w {formatTokens(usage.cacheWriteTokens)}</span>
          <span className="chip">cost {formatUsd(usage.costUsd)}{usage.providerCostUsd !== null ? ` (provider ${formatUsd(usage.providerCostUsd)})` : ""}</span>
        </>
      )}
    </div>
  );
}

async function Outputs({ run }: { run: RunRow }) {
  const ids = (run.outputs ?? []).filter((output) => !output.includes("refinement"));
  const db = getDb();
  const items = ids.length > 0 ? await db.select().from(localItem).where(inArray(localItem.id, ids)) : [];
  const [pbi] = run.pbiId ? await db.select().from(workItem).where(eq(workItem.adoId, run.pbiId)) : [];
  const [version] = run.pbiId ? await db.select().from(refinement).where(and(eq(refinement.pbiId, run.pbiId), eq(refinement.runId, run.id))) : [];

  // The tech-writer's outputs are also the notes it wrote and the draft it removed.
  const notes = ids.filter((output) => !items.some((item) => item.id === output));

  if (!version && items.length === 0 && notes.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <ul>
      {pbi?.vaultPath && <li><NoteLink vault={pbi.vault} path={pbi.vaultPath} label={`PBI-${pbi.adoId} note`} /></li>}
      {version && pbi?.vaultPath && <li><NoteLink vault={pbi.vault} path={pbi.vaultPath.replace(/[^/]+$/, `PBI-${pbi.adoId}-refinement.md`)} label={`Refinement v${version.version}`} /></li>}
      {items.map((item) => (
        <li key={item.id}><Link href={itemPath(item)}>{item.id}</Link>{item.vaultPath && <> (<NoteLink vault={item.vault} path={item.vaultPath} label="note" />)</>} · {item.kind} · {item.status} · {item.title}</li>
      ))}
      {notes.map((note) => <li key={note}><code>{note}</code></li>)}
    </ul>
  );
}

// VaultCapture results: created / appended drafts, or the module's reasons for rejecting.
async function Captures({ runId }: { runId: number }) {
  const captures = await getDb().select().from(vaultCapture).where(eq(vaultCapture.runId, runId));

  if (captures.length === 0) {
    return null;
  }

  return (
    <>
      <h2>Vault captures</h2>
      <ul>
        {captures.map((capture) => (
          <li key={capture.id} className={capture.status === "rejected" ? "result-error" : undefined}>
            {capture.name} · {capture.status}{capture.filePath ? ` · ${capture.filePath}` : ""}{capture.errors.length > 0 ? ` · ${capture.errors.join("; ")}` : ""}
          </li>
        ))}
      </ul>
    </>
  );
}

function Failure({ run, trace }: { run: RunRow; trace: StoredTraceEvent[] }) {
  return (
    <>
      <h2>Failure</h2>
      <p className="result-error">{run.outcome}: {run.error ?? "no message"}</p>
      <p className="muted">Last events before the end:</p>
      <TraceView events={trace.slice(-FAILURE_CONTEXT_EVENTS)} />
    </>
  );
}

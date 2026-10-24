import type { RunSubscriptionShare } from "@agenttools/usage";
import { isFailedOutcome } from "@powerloom/core";
import Link from "next/link";
import { AgentTag } from "@/components/AgentTag";
import { SelectAll } from "@/components/SelectAll";
import { TimeAgo } from "@/components/TimeAgo";
import { formatDuration, formatSharePercent, formatTokens, formatUsd } from "@/lib/format";
import { itemPath } from "@/lib/items";
import type { RunListRow } from "@/lib/runList";
import { outcomeDot } from "@/lib/runOutcomes";
import { RunSelect } from "../runs/RunSelect";

// Six columns that fit (user, 2026-10-18: no sideways scroll): the run with its agent's tag, the task with its facts
// (PBI, model, prompt, its share of the subscription limits) under it, the cost with its tokens, the time it took and
// how it ended; a failed run says why in rose.
export function RunsTable({ rows, shares, palette }: { rows: RunListRow[]; shares: Map<string, RunSubscriptionShare[]>; palette: string[] }) {
  return (
    <div className="panel">
      <table className="data-table vault-table runs-table">
        <thead>
          <tr>
            <th className="col-select"><SelectAll name="taskId" /></th>
            <th className="col-run">Run</th>
            <th>Task</th>
            <th className="col-cost num">Cost</th>
            <th className="col-took num">Took</th>
            <th className="col-outcome">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => <RunRowView key={row.run.id} row={row} shares={shares.get(String(row.run.id)) ?? []} palette={palette} />)}
        </tbody>
      </table>
    </div>
  );
}

function RunRowView({ row, shares, palette }: { row: RunListRow; shares: RunSubscriptionShare[]; palette: string[] }) {
  const { run, task, usage } = row;
  const tokens = usage ? usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens : 0;

  return (
    <tr>
      <td className="col-select"><RunSelect run={run} task={task} /></td>
      <td className="col-run"><Link href={`/agents/runs/${run.id}`} className="id">RUN-{run.id}</Link>{run.continuesRunId && <span className="muted" title={`Continues RUN-${run.continuesRunId}'s conversation`}> ↻</span>}<div className="row-facts"><AgentTag agent={run.stage} palette={palette} /></div></td>
      <td className="title">
        {task ? <Link href={itemPath(task)} className="row-title" title={task.title}>{task.title}</Link> : <span className="muted">No task</span>}
        <div className="row-facts">
          {task && <Link href={itemPath(task)}>{task.id}</Link>}
          {run.pbiId && <Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link>}
          {run.model && <span>{run.model}{run.promptVersion ? ` · ${run.promptVersion}` : ""}</span>}
          {shares.length > 0 && <span>{shares.map((share) => `${share.label} ${formatSharePercent(share.share)}`).join(" · ")}</span>}
          {run.error && isFailedOutcome(run.outcome) && <span className="text-error run-error" title={run.error}>{run.error}</span>}
        </div>
      </td>
      <td className="col-cost num">{usage ? formatUsd(usage.costUsd) : "–"}{usage && <small className="cost-per-run">{formatTokens(tokens)} tokens</small>}</td>
      <td className="col-took num">{usage ? formatDuration(usage.durationMs) : "–"}</td>
      <td className="col-outcome"><span className="run-outcome"><span className={`dot ${outcomeDot(run.outcome)}`} />{run.outcome}</span><small className="cost-per-run"><TimeAgo date={run.startedAt} /></small></td>
    </tr>
  );
}

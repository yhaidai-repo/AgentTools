import { isFailedOutcome, type ReviewTaskData } from "@powerloom/core";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import { formatDuration, formatUsd } from "@/lib/format";
import { itemPath } from "@/lib/items";
import type { ReviewDetail } from "@/models/ReviewDetail";

const MAX_ERROR_CHARS = 300;

type RunRow = ReviewDetail["runs"][number];
type TaskRow = ReviewDetail["tasks"][number];

// Every run of the PR's review tasks, whichever review agent took them (user request 2026-10-16), as rows in the side
// column (user decision 2026-10-18): what started it, how long it took, what it cost and how it ended.
export function ReviewRuns({ detail }: { detail: ReviewDetail }) {
  const tasks = new Map(detail.tasks.map((task) => [task.id, task]));
  const costUsd = detail.runs.reduce((sum, row) => sum + (row.usage?.costUsd ?? 0), 0);

  return (
    <Panel title="Runs" aside={<small>{detail.runs.length} · {formatUsd(costUsd)}</small>}>
      {detail.runs.length === 0 && <p className="hint">No runs yet.</p>}
      {detail.runs.map((row) => <RunLine key={row.run.id} row={row} task={row.run.itemId ? tasks.get(row.run.itemId) ?? null : null} />)}
    </Panel>
  );
}

function RunLine({ row, task }: { row: RunRow; task: TaskRow | null }) {
  const { run, usage } = row;

  return (
    <div className="review-run">
      <span className={`dot ${dotClass(run.outcome)}`} />
      <span><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link> {run.stage}</span>
      <span className="mono">{usage ? formatUsd(usage.costUsd) : "–"}</span>
      <span className="review-run-facts">
        {task ? <Link href={itemPath(task)}>{task.id}</Link> : run.itemId ?? "–"} · {task ? trigger(task.data as ReviewTaskData | null) : "–"}{usage && <> · {formatDuration(usage.durationMs)}</>} · <TimeAgo date={run.startedAt} />
      </span>
      {run.error && <span className="review-run-error">{clip(run.error)}</span>}
    </div>
  );
}

function dotClass(outcome: string): string {
  if (outcome === "running") {
    return "running";
  }

  return isFailedOutcome(outcome) ? "error" : "ok";
}

function trigger(data: ReviewTaskData | null): string {
  if (data?.trigger !== "reviewer-comments") {
    return "queued";
  }

  return data.threads && data.threads.length > 0 ? `reviewer comments (threads ${data.threads.join(", ")})` : "reviewer comments";
}

function clip(text: string): string {
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text;
}

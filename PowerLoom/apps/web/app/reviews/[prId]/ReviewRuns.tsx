import { isFailedOutcome, type ReviewTaskData } from "@powerloom/core";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { formatDuration, formatUsd } from "@/lib/format";
import { itemPath } from "@/lib/items";
import type { ReviewDetail } from "@/models/ReviewDetail";

const MAX_ERROR_CHARS = 300;

// Every run of the PR's review tasks, whichever review agent took them (user request 2026-10-16): what started it, how
// long it took, what it cost and how it ended.
export function ReviewRuns({ detail }: { detail: ReviewDetail }) {
  if (detail.runs.length === 0) {
    return <p className="muted">No runs yet.</p>;
  }

  const tasks = new Map(detail.tasks.map((task) => [task.id, task]));
  const costUsd = detail.runs.reduce((sum, row) => sum + (row.usage?.costUsd ?? 0), 0);

  return (
    <>
      <div className="chips">
        <span className="chip">{detail.runs.length} run{detail.runs.length === 1 ? "" : "s"}</span>
        <span className="chip">cost {formatUsd(costUsd)}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Run</th><th>Agent</th><th>Started</th><th>Task</th><th>Started by</th><th>Duration</th><th>Cost</th><th>Outcome</th></tr>
          </thead>
          <tbody>
            {detail.runs.map(({ run, usage }) => {
              const task = run.itemId ? tasks.get(run.itemId) ?? null : null;

              return (
                <tr key={run.id}>
                  <td><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link></td>
                  <td>{run.stage}</td>
                  <td><LocalTime date={run.startedAt} /></td>
                  <td>{task ? <Link href={itemPath(task)}>{task.id}</Link> : run.itemId ?? "–"}</td>
                  <td>{task ? trigger(task.data as ReviewTaskData | null) : "–"}</td>
                  <td>{usage ? formatDuration(usage.durationMs) : "–"}</td>
                  <td>{usage ? formatUsd(usage.costUsd) : "–"}</td>
                  <td className={isFailedOutcome(run.outcome) ? "result-error" : undefined}>
                    {run.outcome}
                    {run.error ? <div className="muted">{clip(run.error)}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
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

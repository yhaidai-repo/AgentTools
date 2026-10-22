import type { runResult } from "@powerloom/db";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { itemPath } from "@/lib/items";

type RunResultRow = typeof runResult.$inferSelect;

// Where a run result comes from, on its full page: its task and PBI, the agent that wrote it, how far it got, when,
// and the run it ends.
export function RunResultHeader({ row }: { row: RunResultRow }) {
  return (
    <dl className="run-result-head">
      <dt>Task</dt>
      <dd>{row.taskId === null ? "–" : <Link href={itemPath({ id: row.taskId, pbiId: row.pbiId })}>{row.taskId}</Link>}</dd>
      <dt>PBI</dt>
      <dd>{row.pbiId === null ? "–" : <Link href={`/pbis/${row.pbiId}`}>PBI-{row.pbiId}</Link>}</dd>
      <dt>Agent</dt>
      <dd>{row.agent}</dd>
      <dt>Status</dt>
      <dd><span className={`run-result-status status-${row.status}`}>{row.status}</span></dd>
      <dt>Created</dt>
      <dd><LocalTime date={row.createdAt} /></dd>
      <dt>Run</dt>
      <dd>{row.runId === null ? "–" : <Link href={`/agents/runs/${row.runId}`}>RUN-{row.runId}</Link>}</dd>
    </dl>
  );
}

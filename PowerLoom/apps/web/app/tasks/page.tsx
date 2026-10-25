import { TASK_TYPE_PATTERN, isFailedOutcome, listVaultTaskSchedules } from "@powerloom/core";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NoVault } from "@/components/NoVault";
import { Pager } from "@/components/Pager";
import { RememberFilters } from "@/components/RememberFilters";
import { SelectAll } from "@/components/SelectAll";
import { TaskKindTag, TaskStatePill } from "@/components/TaskTags";
import { TimeAgo } from "@/components/TimeAgo";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { itemPath } from "@/lib/items";
import { periodOf } from "@/lib/ranges";
import { rememberedParams } from "@/lib/rememberedFilters";
import { TASK_KINDS, TASK_PAGE_SIZES, bucketOf, countBy, loadTaskList, matchesTask, sortTasks, type TaskRow } from "@/lib/taskList";
import { isSelectableTask } from "@/lib/taskListActions";
import { isHumanWork } from "@/lib/taskLooks";
import { UPDATED_FIRST, tasksUrl } from "@/lib/tasksUrl";
import type { TaskFilter } from "@/models/TaskFilter";
import { ScheduleTable } from "./ScheduleTable";
import { TaskFilters } from "./TaskFilters";
import { TaskSelectionForm } from "./TaskSelectionForm";
import { GRID_REFRESH_MS } from "@/lib/gridRefresh";

export const dynamic = "force-dynamic";

const STATUSES: TaskFilter["status"][] = ["you", "open", "held", "done", "cancelled", "all"];

type SearchParams = Promise<{ kind?: string; status?: string; pbi?: string; range?: string; sort?: string; page?: string; size?: string }>;

// All tasks, questions and findings of the vault, including those of no PBI (e.g. tech-writer tasks for drafts captured
// in chat): what waits on you first, then the latest change (user decisions 2026-10-18); schedules below the list.
export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Tasks" />;
  }

  const filter = filterOf(await rememberedParams("/tasks", await searchParams));
  const loaded = await loadTaskList(filter, vault);
  const rows = filter.youFirst ? sortTasks(loaded) : loaded;
  const ofKind = rows.filter((row) => filter.kind === "" || row.kind === filter.kind);
  const ofStatus = rows.filter((row) => filter.status === "all" || bucketOf(row) === filter.status);
  const shown = rows.filter((row) => matchesTask(row, filter));
  const pages = Math.max(Math.ceil(shown.length / filter.size), 1);
  const page = Math.min(filter.page, pages);

  return (
    <>
      <div className="page-head">
        <h1>Tasks</h1>
        <AutoRefresh active intervalMs={GRID_REFRESH_MS} />
        <Link className="button page-action" href="/tasks/new">New task</Link>
      </div>
      <RememberFilters vault={vault} />
      <TaskFilters filter={filter} total={ofKind.length} buckets={countBy(ofKind, bucketOf)} kinds={withChosenKind(countBy(ofStatus, (row) => row.kind), filter.kind)} />
      {shown.length === 0 ? <p className="empty-note">Nothing matches.</p> : <TaskSelectionForm><TaskTable rows={shown.slice((page - 1) * filter.size, page * filter.size)} /></TaskSelectionForm>}
      {shown.length > 0 && <Pager page={page} size={filter.size} sizes={TASK_PAGE_SIZES} pages={pages} total={shown.length} noun="tasks" hrefOf={(change) => tasksUrl({ ...filter, page: change.page, size: change.size ?? filter.size })} />}
      <div className="section-label">Scheduled tasks</div>
      <ScheduleTable schedules={await listVaultTaskSchedules(getDb(), vault)} />
    </>
  );
}

// Each pill row counts within the other's choice (the kinds within the chosen status); the chosen kind keeps its pill
// even when the status has none of it, so the choice stays visible.
function withChosenKind(kinds: Map<string, number>, kind: string): Map<string, number> {
  return kind === "" || kinds.has(kind) ? kinds : new Map([...kinds, [kind, 0]]);
}

function filterOf(params: Record<string, string | undefined>): TaskFilter {
  return {
    kind: TASK_KINDS.find((kind) => kind === params.kind) ?? (params.kind && TASK_TYPE_PATTERN.test(params.kind) ? params.kind : ""),
    status: STATUSES.find((status) => status === params.status) ?? "all",
    pbi: (params.pbi ?? "").trim(),
    range: periodOf(params.range),
    youFirst: params.sort !== UPDATED_FIRST,
    page: Math.max(Number(params.page) || 1, 1),
    size: TASK_PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : TASK_PAGE_SIZES[0],
  };
}

// A select column and four columns, like the Backlog: the facts of a task go on a quiet line under its title. Human work is warm, and while
// it waits on you its row has an amber edge (user request 2026-10-18).
function TaskTable({ rows }: { rows: TaskRow[] }) {
  return (
    <div className="panel task-table">
      <table className="data-table">
        <thead>
          <tr><th className="col-select"><SelectAll name="taskId" /></th><th className="col-id">ID</th><th>Task</th><th className="col-state">Status</th><th className="col-updated num">Updated</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => <TaskRowView key={row.id} row={row} />)}
        </tbody>
      </table>
    </div>
  );
}

function TaskRowView({ row }: { row: TaskRow }) {
  const bucket = bucketOf(row);
  const classes = [isHumanWork(row) ? "human" : "", bucket === "you" ? "waiting" : "", bucket === "done" || bucket === "cancelled" ? "settled" : ""].filter(Boolean).join(" ");

  return (
    <tr className={classes || undefined}>
      <td className="col-select">{isSelectableTask(row) && <input type="checkbox" name="taskId" value={row.id} aria-label={`Select ${row.id}`} />}</td>
      <td className="col-id"><Link href={itemPath(row)} className="id">{row.id}</Link></td>
      <td className="title">
        <Link href={itemPath(row)} className="row-title" title={row.title}>{row.title}</Link>
        <div className="row-facts">
          <TaskKindTag kind={row.kind} />
          {isHumanWork(row) && <span className="for-who">{bucket === "you" ? "for you" : "yours"}</span>}
          {row.pbiId === null ? <span>no PBI</span> : <Link href={`/pbis/${row.pbiId}`}>PBI-{row.pbiId}</Link>}
          {row.parentId && <span>from {row.parentId}</span>}
          <TaskRuns runs={row.runs} />
          {bucket === "held" && <span className="text-warn">held: {[...new Set(row.heldBy)].join("; ")}</span>}
        </div>
      </td>
      <td className="col-state"><TaskStatePill task={row} /></td>
      <td className="col-updated num"><TimeAgo date={row.updatedAt} /></td>
    </tr>
  );
}

const SHOWN_RUNS = 2;

function runMark(outcome: string): string {
  if (outcome === "running") {
    return " …";
  }

  return isFailedOutcome(outcome) ? " ✗" : " ✓";
}

// The task's latest runs; a failed one in rose, so it stays visible after a later success.
function TaskRuns({ runs }: { runs: TaskRow["runs"] }) {
  if (runs.length === 0) {
    return null;
  }

  return (
    <span>
      {runs.slice(0, SHOWN_RUNS).map((run, index) => (
        <span key={run.id}>
          {index > 0 && ", "}
          <Link href={`/agents/runs/${run.id}`} className={isFailedOutcome(run.outcome) ? "text-error" : undefined}>RUN-{run.id}{runMark(run.outcome)}</Link>
        </span>
      ))}
      {runs.length > SHOWN_RUNS && <> +{runs.length - SHOWN_RUNS}</>}
    </span>
  );
}

import { listVaultTaskSchedules } from "@powerloom/core";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { RememberFilters } from "@/components/RememberFilters";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { rememberedParams } from "@/lib/rememberedFilters";
import { isOpen, itemPath } from "@/lib/items";
import { DEFAULT_RANGE, RANGES, rangeOptions } from "@/lib/ranges";
import { TASK_KINDS, loadTaskList, type TaskRow } from "@/lib/taskList";
import type { TaskFilter } from "@/models/TaskFilter";
import { NewTaskMenu } from "./NewTaskMenu";
import { ScheduleTable } from "./ScheduleTable";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string; status?: string; pbi?: string; range?: string; sort?: string; dir?: string }>;

const STATUS_FILTERS: TaskFilter["status"][] = ["open", "closed", "all"];

// All tasks, questions and findings, including those of no PBI (e.g. tech-writer tasks for drafts captured in chat).
export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await rememberedParams("/tasks", await searchParams);
  const filter: TaskFilter = {
    kind: params.kind ?? "",
    status: STATUS_FILTERS.find((status) => status === params.status) ?? "all",
    pbi: (params.pbi ?? "").trim(),
    range: params.range && RANGES[params.range] ? params.range : DEFAULT_RANGE,
    sort: params.sort === "updated" ? "updated" : "created",
    dir: params.dir === "asc" ? "asc" : "desc",
  };
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Tasks" />;
  }

  const rows = await loadTaskList(filter, vault);

  return (
    <>
      <h1>Tasks</h1>
      <NewTaskMenu />
      <h2>Scheduled tasks</h2>
      <ScheduleTable schedules={await listVaultTaskSchedules(getDb(), vault)} />
      <h2>Tasks</h2>
      <RememberFilters />
      <TaskFilters key={JSON.stringify(filter)} filter={filter} kinds={TASK_KINDS} ranges={rangeOptions()} />
      {rows.length === 0 ? <p className="muted">Nothing matches.</p> : <TaskTable rows={rows} filter={filter} />}
    </>
  );
}

function TaskTable({ rows, filter }: { rows: TaskRow[]; filter: TaskFilter }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Id</th><th>Kind</th><th>Status</th><th>For</th><th>PBI</th><th>Run</th><th>Title</th><SortHeader filter={filter} column="created" label="Created" /><SortHeader filter={filter} column="updated" label="Updated" /></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={itemPath(row)}>{row.id}</Link></td>
              <td>{row.kind}</td>
              <td className={isOpen(row) && row.assignee === "human" ? "result-error" : undefined}>{row.status}{row.heldBy.length > 0 && row.status === "open" ? " (held)" : ""}</td>
              <td>{row.assignee.replace("agent:", "")}</td>
              <td>{row.pbiId === null ? "–" : <Link href={`/pbis/${row.pbiId}`}>PBI-{row.pbiId}</Link>}</td>
              <td><TaskRuns runs={row.runs} /></td>
              <td>{row.title}</td>
              <td><LocalTime date={row.createdAt} /></td>
              <td><LocalTime date={row.updatedAt} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SHOWN_RUNS = 3;

// The task's runs, newest first; failures in red, so a failed run stays visible after a later success.
function TaskRuns({ runs }: { runs: TaskRow["runs"] }) {
  if (runs.length === 0) {
    return <>–</>;
  }

  const hidden = runs.length - SHOWN_RUNS;

  return (
    <>
      {runs.slice(0, SHOWN_RUNS).map((run, index) => (
        <span key={run.id}>
          {index > 0 && ", "}
          <Link href={`/agents/runs/${run.id}`} className={isFailure(run.outcome) ? "result-error" : undefined}>RUN-{run.id} · {run.outcome}</Link>
        </span>
      ))}
      {hidden > 0 && <span className="muted"> +{hidden} more</span>}
    </>
  );
}

function isFailure(outcome: string): boolean {
  return !["success", "running", "no-op"].includes(outcome);
}

// Click to sort by this date, newest first; click again to flip the order. The filters stay as they are.
function SortHeader({ filter, column, label }: { filter: TaskFilter; column: TaskFilter["sort"]; label: string }) {
  const isActive = filter.sort === column;
  const dir = isActive && filter.dir === "desc" ? "asc" : "desc";
  const query = new URLSearchParams({ kind: filter.kind, status: filter.status, pbi: filter.pbi, range: filter.range, sort: column, dir });
  const arrow = filter.dir === "desc" ? " ↓" : " ↑";

  return <th><Link href={`/tasks?${query}`}>{label}{isActive ? arrow : ""}</Link></th>;
}

import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { isOpen, itemPath } from "@/lib/items";
import { loadTaskList, type TaskRow } from "@/lib/taskList";
import type { TaskFilter } from "@/models/TaskFilter";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string; status?: string; pbi?: string }>;

const STATUS_FILTERS: TaskFilter["status"][] = ["open", "closed", "all"];

// All tasks, questions and findings, including those of no PBI (e.g. tech-writer tasks for drafts captured in chat).
export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter: TaskFilter = {
    kind: params.kind ?? "",
    status: STATUS_FILTERS.find((status) => status === params.status) ?? "open",
    pbi: (params.pbi ?? "").trim(),
  };
  const rows = await loadTaskList(filter);

  return (
    <>
      <h1>Tasks</h1>
      <TaskFilters filter={filter} />
      {rows.length === 0 ? <p className="muted">Nothing matches.</p> : <TaskTable rows={rows} />}
    </>
  );
}

function TaskTable({ rows }: { rows: TaskRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Id</th><th>Kind</th><th>Status</th><th>For</th><th>PBI</th><th>Title</th><th>Created</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={itemPath(row)}>{row.id}</Link></td>
              <td>{row.kind}</td>
              <td className={isOpen(row) && row.assignee === "human" ? "result-error" : undefined}>{row.status}{row.heldBy.length > 0 && row.status === "open" ? " (held)" : ""}</td>
              <td>{row.assignee.replace("agent:", "")}</td>
              <td>{row.pbiId === null ? "–" : <Link href={`/pbis/${row.pbiId}`}>PBI-{row.pbiId}</Link>}</td>
              <td>{row.title}</td>
              <td><LocalTime date={row.createdAt} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

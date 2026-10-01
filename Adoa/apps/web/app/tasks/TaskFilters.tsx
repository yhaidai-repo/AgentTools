import { TASK_KINDS } from "@/lib/taskList";
import type { TaskFilter } from "@/models/TaskFilter";

// Plain GET form: filters live in the URL, no client state needed.
export function TaskFilters({ filter }: { filter: TaskFilter }) {
  return (
    <form method="get" className="toolbar filters">
      <label>
        Kind
        <select name="kind" defaultValue={filter.kind}>
          <option value="">All</option>
          {TASK_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={filter.status}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </label>
      <label>
        PBI
        <input name="pbi" defaultValue={filter.pbi} placeholder="any, none or an id" size={14} />
      </label>
      <button type="submit" className="secondary">Filter</button>
    </form>
  );
}

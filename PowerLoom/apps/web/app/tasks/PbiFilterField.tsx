import type { TaskFilter } from "@/models/TaskFilter";

// The PBI filter: any, "none" (items without a PBI) or a PBI's id; applies on Enter, the other filters stay.
export function PbiFilterField({ filter }: { filter: TaskFilter }) {
  return (
    <form method="get" action="/tasks" className="pbi-filter">
      <input type="hidden" name="status" value={filter.status} />
      <input type="hidden" name="kind" value={filter.kind} />
      <input type="hidden" name="range" value={filter.range} />
      <input name="pbi" defaultValue={filter.pbi} placeholder="PBI: any, none or an id" aria-label="PBI" size={22} />
    </form>
  );
}

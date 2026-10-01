"use client";

import type { TaskFilter } from "@/models/TaskFilter";

// Applies on change (the PBI field on Enter): the filters live in the URL, no Filter button.
export function TaskFilters({ filter, kinds }: { filter: TaskFilter; kinds: readonly string[] }) {
  return (
    <form method="get" className="toolbar filters">
      <input type="hidden" name="sort" value={filter.sort} />
      <input type="hidden" name="dir" value={filter.dir} />
      <label>
        Kind
        <select name="kind" defaultValue={filter.kind} onChange={submitForm}>
          <option value="">All</option>
          {kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={filter.status} onChange={submitForm}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <label>
        PBI
        <input name="pbi" defaultValue={filter.pbi} placeholder="any, none or an id (Enter)" size={22} />
      </label>
    </form>
  );
}

function submitForm(event: React.ChangeEvent<HTMLSelectElement>) {
  event.currentTarget.form?.requestSubmit();
}

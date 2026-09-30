import type { BacklogFilter } from "@/models/BacklogFilter";

interface BacklogFiltersProps {
  filter: BacklogFilter;
  sprints: string[];
  states: string[];
}

// Plain GET form: filters live in the URL, no client state needed.
export function BacklogFilters({ filter, sprints, states }: BacklogFiltersProps) {
  return (
    <form method="get" className="toolbar filters">
      <label>
        Sprint
        <select name="sprint" defaultValue={filter.sprint}>
          <option value="">All</option>
          {sprints.map((sprint) => (
            <option key={sprint} value={sprint}>{sprint}</option>
          ))}
        </select>
      </label>
      <label>
        ADO state
        <select name="state" defaultValue={filter.state}>
          <option value="">All</option>
          {states.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </label>
      <label className="inline">
        <input type="checkbox" name="outOfScope" value="1" defaultChecked={filter.showOutOfScope} />
        Show out of scope
      </label>
      <button type="submit" className="secondary">Filter</button>
    </form>
  );
}

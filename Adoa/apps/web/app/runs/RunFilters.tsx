"use client";

import type { RunListFilter } from "@/models/RunListFilter";

interface RunFiltersProps {
  filter: RunListFilter;
  agents: string[];
  ranges: { key: string; label: string }[];
}

// Applies on change: the filters live in the URL, no button.
export function RunFilters({ filter, agents, ranges }: RunFiltersProps) {
  return (
    <form method="get" className="toolbar filters">
      <input type="hidden" name="outcome" value={filter.outcome} />
      <label>
        Agent
        <select name="agent" defaultValue={filter.agent} onChange={submitForm}>
          <option value="">All</option>
          {agents.map((agent) => <option key={agent} value={agent}>{agent}</option>)}
        </select>
      </label>
      <label>
        Period
        <select name="range" defaultValue={filter.range} onChange={submitForm}>
          {ranges.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
    </form>
  );
}

function submitForm(event: React.ChangeEvent<HTMLSelectElement>) {
  event.currentTarget.form?.requestSubmit();
}

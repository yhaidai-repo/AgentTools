"use client";

// Apply on change: period and agent live in the URL, no Filter button.
export function VaultFilters({ range, agent, ranges, agents }: { range: string; agent: string; ranges: { key: string; label: string }[]; agents: string[] }) {
  return (
    <form method="get" className="toolbar filters">
      <label>
        Period
        <select name="range" defaultValue={range} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {ranges.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>
        Agent
        <select name="agent" defaultValue={agent} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {agents.map((value) => <option key={value} value={value}>{value === "adoa" ? "adoa (all agents)" : value}</option>)}
        </select>
      </label>
    </form>
  );
}

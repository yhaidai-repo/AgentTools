"use client";

interface AgentChartFiltersProps {
  agent: string;
  metric: string;
  agents: { key: string; label: string }[];
  metrics: { key: string; label: string }[];
  /** Other URL parameters the page needs, kept through the change (the tab, the period). */
  keep: Record<string, string>;
}

// The agent chart's agent and what it shows; applies on change, the choice lives in the URL.
export function AgentChartFilters({ agent, metric, agents, metrics, keep }: AgentChartFiltersProps) {
  return (
    <form method="get" className="toolbar filters">
      {Object.entries(keep).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label>
        Agent
        <select name="agent" defaultValue={agent} onChange={submitForm}>
          <option value="">All</option>
          {agents.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>
        Show
        <select name="metric" defaultValue={metric} onChange={submitForm}>
          {metrics.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
    </form>
  );
}

function submitForm(event: React.ChangeEvent<HTMLSelectElement>) {
  event.currentTarget.form?.requestSubmit();
}

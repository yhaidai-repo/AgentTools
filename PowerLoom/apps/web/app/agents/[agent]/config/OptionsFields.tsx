import type { AgentDefinition } from "@agenttools/config";

// One row per option the agent's code declares: its label and range with the description under it, the number on the
// right; there are no free-form options to add.
export function OptionsFields({ agent }: { agent: AgentDefinition }) {
  if (agent.optionSpecs.length === 0) {
    return null;
  }

  return (
    <section className="panel config-section">
      <h3>Options</h3>
      {agent.optionSpecs.map((spec) => (
        <label key={spec.key} className="option-row">
          <span className="option-text">{spec.label}<small>{spec.min}–{spec.max} · {spec.description}</small></span>
          <input name={`option:${spec.key}`} type="number" min={spec.min} max={spec.max} step={1} defaultValue={valueOf(agent, spec.key, spec.min)} required />
        </label>
      ))}
    </section>
  );
}

// An option the definition doesn't hold yet (a spec added after the agent was saved, or an agent copied from one without
// it) shows the range's minimum: an empty required field would block the whole form silently.
function valueOf(agent: AgentDefinition, key: string, fallback: number): number {
  const value = agent.options[key];

  return typeof value === "number" ? value : fallback;
}

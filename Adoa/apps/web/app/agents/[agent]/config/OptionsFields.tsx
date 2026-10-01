import type { AgentDefinition } from "@agenttools/config";

// One labeled field per option the agent's code declares; there are no free-form options to add.
export function OptionsFields({ agent }: { agent: AgentDefinition }) {
  if (agent.optionSpecs.length === 0) {
    return null;
  }

  return (
    <fieldset className="field-group">
      <legend>Options</legend>
      {agent.optionSpecs.map((spec) => (
        <label key={spec.key}>
          {spec.label} ({spec.min}–{spec.max})
          <input name={`option:${spec.key}`} type="number" min={spec.min} max={spec.max} step={1} defaultValue={Number(agent.options[spec.key])} required />
          <span className="muted">{spec.description}</span>
        </label>
      ))}
    </fieldset>
  );
}

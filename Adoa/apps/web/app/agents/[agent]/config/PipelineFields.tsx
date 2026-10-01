import type { BlockerKind } from "@adoa/core";
import type { AgentDefinition } from "@agenttools/config";

// Where the agent sits in the pipeline: the agent the worker calls after a successful task, and what it waits for.
export function PipelineFields({ agent, agentIds, blockerKinds }: { agent: AgentDefinition; agentIds: string[]; blockerKinds: BlockerKind[] }) {
  const others = agentIds.filter((id) => id !== agent.id);

  return (
    <fieldset className="field-group">
      <legend>Pipeline</legend>
      <label>
        Next agent (gets a task when one of this agent's tasks succeeds)
        <select name="next" defaultValue={agent.next ?? ""}>
          <option value="">None</option>
          {[...new Set([...others, ...(agent.next ? [agent.next] : [])])].map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <span className="muted">Wait for (the worker doesn&apos;t start this agent on a PBI until each ticked check passes):</span>
      {blockerKinds.map((kind) => (
        <label key={kind.key} className="inline choice">
          <input type="checkbox" name="waitFor" value={kind.key} defaultChecked={agent.waitFor.includes(kind.key)} />
          <span><strong>{kind.label}</strong> <span className="muted">{kind.description}</span></span>
        </label>
      ))}
    </fieldset>
  );
}

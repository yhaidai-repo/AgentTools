import { AGENT_TASK_TYPES, CREATABLE_TASK_TYPES, type BlockerKind } from "@powerloom/core";
import type { AgentDefinition } from "@agenttools/config";

// Where the agent sits in the pipeline: the agent the worker calls after a successful task, and what it waits for.
export function PipelineFields({ agent, agentIds, blockerKinds }: { agent: AgentDefinition; agentIds: string[]; blockerKinds: BlockerKind[] }) {
  const others = agentIds.filter((id) => id !== agent.id);
  // Kept so saving doesn't drop it silently: e.g. the default "design" before a design agent exists.
  const unknownNext = agent.next && !agentIds.includes(agent.next) ? agent.next : null;

  return (
    <fieldset className="field-group">
      <legend>Pipeline</legend>
      <label>
        Next agent (gets a task when one of this agent's tasks succeeds)
        <select name="next" defaultValue={agent.next ?? ""}>
          <option value="">None</option>
          {others.map((id) => <option key={id} value={id}>{id}</option>)}
          {unknownNext && <option value={unknownNext}>{unknownNext} (no such agent yet: its tasks wait)</option>}
        </select>
      </label>
      {unknownNext && <span className="result-error">&quot;{unknownNext}&quot; isn&apos;t configured: the tasks this creates wait until such an agent exists.</span>}
      <span className="muted">Takes tasks of type (besides the tasks pinned to it; with two agents of a type on, whichever runs first takes a task):</span>
      {AGENT_TASK_TYPES.map((type) => (
        <label key={`handles-${type}`} className="inline choice">
          <input type="checkbox" name="handles" value={type} defaultChecked={agent.handles.includes(type)} />
          <span>{type}</span>
        </label>
      ))}
      <span className="muted">Can create tasks of type (agents with the create_task tool choose what comes next; the user always can get one):</span>
      {CREATABLE_TASK_TYPES.map((type) => (
        <label key={`assign-${type}`} className="inline choice">
          <input type="checkbox" name="canAssign" value={type} defaultChecked={agent.canAssign.includes(type)} />
          <span>{type}</span>
        </label>
      ))}
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

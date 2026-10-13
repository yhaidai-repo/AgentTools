import type { BlockerKind } from "@powerloom/core";
import type { AgentDefinition } from "@agenttools/config";
import type { TaskTypeChoices } from "@/models/TaskTypeChoices";

// Where the agent sits in the pipeline: the task types it takes and may create, and what it waits for. There are task
// types, not agent types, and agents decide what comes next (user decisions 2026-10-13).
export function PipelineFields({ agent, blockerKinds, taskTypes }: { agent: AgentDefinition; blockerKinds: BlockerKind[]; taskTypes: TaskTypeChoices }) {
  return (
    <fieldset className="field-group">
      <legend>Pipeline</legend>
      <span className="muted">Takes tasks of type (besides the tasks pinned to it; when several agents take a type, whichever runs first takes a task):</span>
      {taskTypes.agent.map((type) => (
        <label key={`handles-${type}`} className="inline choice">
          <input type="checkbox" name="handles" value={type} defaultChecked={agent.handles.includes(type)} />
          <span>{type}</span>
        </label>
      ))}
      <span className="muted">Can create tasks of type (agents with the create_task tool choose what comes next; the user always can get one):</span>
      {taskTypes.creatable.map((type) => (
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

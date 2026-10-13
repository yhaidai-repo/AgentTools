import type { BlockerKind } from "@powerloom/core";
import type { AgentDefinition } from "@agenttools/config";
import type { TaskTypeChoices } from "@/models/TaskTypeChoices";

// Where the agent sits in the pipeline: the task types it takes and creates, the task type that follows its successful
// task, and what it waits for. There are task types, not agent types (user decision 2026-10-13).
export function PipelineFields({ agent, blockerKinds, taskTypes }: { agent: AgentDefinition; blockerKinds: BlockerKind[]; taskTypes: TaskTypeChoices }) {
  // Kept so saving doesn't drop it silently: an older value that isn't a pipeline task type.
  const unknownNext = agent.next && !taskTypes.pipeline.includes(agent.next) ? agent.next : null;

  return (
    <fieldset className="field-group">
      <legend>Pipeline</legend>
      <label>
        Next task (created when one of this agent's tasks succeeds; any agent taking that type picks it up)
        <select name="next" defaultValue={agent.next ?? ""}>
          <option value="">None</option>
          {taskTypes.pipeline.map((type) => <option key={type} value={type}>{type}</option>)}
          {unknownNext && <option value={unknownNext}>{unknownNext} (not a pipeline task type)</option>}
        </select>
      </label>
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

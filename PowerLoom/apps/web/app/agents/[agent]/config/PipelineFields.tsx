import type { BlockerKind } from "@powerloom/core";
import type { AgentDefinition } from "@agenttools/config";
import { SwitchField } from "@/components/SwitchField";
import type { TaskTypeChoices } from "@/models/TaskTypeChoices";

// Where the agent sits in the pipeline: the task types it takes and may create (toggle chips), and what it waits for
// (switches). There are task types, not agent types, and agents decide what comes next (user decisions 2026-10-13); an
// agent may bring a new type of its own, which then is a task type like the others (user decision 2026-10-24).
export function PipelineFields({ agent, blockerKinds, taskTypes }: { agent: AgentDefinition; blockerKinds: BlockerKind[]; taskTypes: TaskTypeChoices }) {
  return (
    <section className="panel config-section">
      <h3>Pipeline</h3>
      <div className="field">
        <span>Takes tasks of type<small>besides the tasks pinned to it; when several agents take a type, the first free one does</small></span>
        <TypeChips name="handles" types={taskTypes.agent} checked={agent.handles} />
        <input name="newTaskType" pattern="[a-z][a-z0-9-]*" placeholder="A new type of its own, e.g. security-review" aria-label="New task type" />
      </div>
      <div className="field">
        <span>Can create tasks of type<small>gives it create_task, so it decides what comes next; you can always get one</small></span>
        <TypeChips name="canAssign" types={taskTypes.creatable} checked={agent.canAssign} />
      </div>
      <span className="field-label">Waits until<small>the worker starts it on a PBI only when each switched-on check passes</small></span>
      {blockerKinds.map((kind) => <SwitchField key={kind.key} name="waitFor" value={kind.key} label={kind.label} hint={kind.description} defaultChecked={agent.waitFor.includes(kind.key)} />)}
    </section>
  );
}

// Each type is a checkbox drawn as a chip that lights up when chosen (as the repositories on New task).
function TypeChips({ name, types, checked }: { name: string; types: string[]; checked: string[] }) {
  return (
    <div className="repo-chips">
      {types.map((type) => (
        <label key={type} className="repo-check">
          <input type="checkbox" name={name} value={type} defaultChecked={checked.includes(type)} />
          <span>{type}</span>
        </label>
      ))}
    </div>
  );
}

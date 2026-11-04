import { flowMarkersOf } from "@powerloom/core/src/flowSteps";
import { flowExecutionUrl } from "@/lib/flowUrl";
import { kindTag, taskState } from "@/lib/taskLooks";
import type { TaskLike } from "@/models/TaskLike";

// A task's kind as a tag: warm for human work, cool for agent work.
export function TaskKindTag({ kind }: { kind: string }) {
  const tag = kindTag(kind);

  return <span className={`kind-tag ${tag.tone}`}>{tag.label}</span>;
}

// A task's state as a pill.
export function TaskStatePill({ task }: { task: TaskLike }) {
  const state = taskState(task);

  return <span className={`task-pill ${state.tone}`}>{state.label}</span>;
}

// A task of a flow execution (data.flowExecutionId, PowerLoom Flow phase 2): a small tag linking to the execution in
// the Flow app (FLOW_URL); nothing for every other task.
export function FlowTag({ data }: { data: unknown }) {
  const markers = flowMarkersOf(data);

  if (!markers) {
    return null;
  }

  return <a className="kind-tag kind-flow" href={flowExecutionUrl(markers.flowExecutionId)} title={`Flow execution ${markers.flowExecutionId}, node ${markers.flowNodeId}: open it in PowerLoom Flow`}>flow {markers.flowExecutionId}</a>;
}

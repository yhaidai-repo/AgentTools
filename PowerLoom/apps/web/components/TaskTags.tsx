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

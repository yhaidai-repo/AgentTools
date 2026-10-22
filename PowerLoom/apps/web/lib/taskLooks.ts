import { isOpen } from "./items";
import type { TaskLike } from "@/models/TaskLike";

export type TaskBucket = "you" | "held" | "open" | "done" | "cancelled";

// The kinds' tags: human work is warm (user request 2026-10-18: tasks for humans stand out), agent work keeps the cool
// colours of its pipeline stage.
const KIND_TAGS: Record<string, { label: string; tone: string }> = {
  human: { label: "Human task", tone: "kind-human" },
  question: { label: "Question", tone: "kind-human" },
  finding: { label: "Finding", tone: "kind-human" },
  refinement: { label: "Refinement", tone: "kind-refine" },
  research: { label: "Research", tone: "kind-refine" },
  design: { label: "Design", tone: "kind-design" },
  docs: { label: "Docs", tone: "kind-docs" },
  review: { label: "Review", tone: "kind-review" },
  "vault-review": { label: "Vault review", tone: "kind-docs" },
  meeting: { label: "Meeting", tone: "kind-meeting" },
  test: { label: "Test", tone: "kind-review" },
  "test-report": { label: "Test report", tone: "kind-review" },
};

const CLOSED_LABELS: Record<string, string> = { done: "Done", answered: "Answered", final: "Done", cancelled: "Cancelled", dismissed: "Dismissed", superseded: "Superseded", deleted: "Deleted" };

export function kindTag(kind: string): { label: string; tone: string } {
  return KIND_TAGS[kind] ?? { label: kind, tone: "kind-docs" };
}

export function isHumanWork(task: TaskLike): boolean {
  return task.assignee === "human";
}

// What a task waits for: you (an open human item), the dispatcher (held), an agent (open), or nothing any more.
export function taskBucket(task: TaskLike): TaskBucket {
  if (!isOpen(task)) {
    return ["cancelled", "dismissed", "superseded", "deleted"].includes(task.status) ? "cancelled" : "done";
  }

  if (isHumanWork(task)) {
    return "you";
  }

  return task.status === "open" && task.heldBy.length > 0 ? "held" : "open";
}

// The status pill: "Waits for you" pulses amber, a running agent task pulses cyan, held is dashed, closed is quiet.
export function taskState(task: TaskLike): { label: string; tone: string } {
  const bucket = taskBucket(task);

  if (bucket === "you") {
    return { label: "Waits for you", tone: "task-wait" };
  }

  if (bucket === "held") {
    return { label: "Held", tone: "task-held" };
  }

  if (bucket === "open") {
    return task.status === "in-progress" ? { label: "Running", tone: "task-run" } : { label: "Open", tone: "task-open" };
  }

  return { label: CLOSED_LABELS[task.status] ?? task.status, tone: bucket === "done" ? "task-done" : "task-off" };
}

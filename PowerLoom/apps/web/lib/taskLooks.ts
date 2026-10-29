import { taskBucket, type TaskLike } from "@powerloom/core";

// The bucket and its rule live in core (shared with task.list); the tags and pills stay here.
export { isHumanWork, taskBucket, type TaskBucket } from "@powerloom/core";

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
  "support-guide": { label: "Demonstration", tone: "kind-review" },
  "support-guide-result": { label: "Demonstration guide", tone: "kind-review" },
};

const CLOSED_LABELS: Record<string, string> = { done: "Done", answered: "Answered", final: "Done", cancelled: "Cancelled", dismissed: "Dismissed", superseded: "Superseded", deleted: "Deleted" };

export function kindTag(kind: string): { label: string; tone: string } {
  return KIND_TAGS[kind] ?? { label: kind, tone: "kind-docs" };
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

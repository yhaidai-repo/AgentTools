// Every question and task may be deleted (a test, meeting or vault-review task and a task type of its own too); results
// are agent output, not work items, and a review has its own delete. The soft delete itself is PowerLoom's.
const NOT_DELETABLE_KINDS = ["research-result", "test-report", "review"];

// Whether the user may delete it now (the pages show the button only then).
export function isDeletableItem(item: { kind: string; status: string }): boolean {
  return !NOT_DELETABLE_KINDS.includes(item.kind) && item.status !== "in-progress" && item.status !== "deleted";
}

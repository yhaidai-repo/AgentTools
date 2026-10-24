// Questions and tasks the user may delete; results and refinements are agent output, not work items. The soft delete
// itself is PowerLoom's; the pages show the button for these.
const DELETABLE_KINDS = ["question", "human", "finding", "research", "refinement", "design", "docs"];

// Whether the user may delete it now (the pages show the button only then).
export function isDeletableItem(item: { kind: string; status: string }): boolean {
  return DELETABLE_KINDS.includes(item.kind) && item.status !== "in-progress" && item.status !== "deleted";
}

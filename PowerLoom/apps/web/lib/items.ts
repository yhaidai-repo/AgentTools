// The item rules live in core (shared with the task commands); the page path stays here.
export { RESULT_KINDS, isOpen, isResultKind } from "@powerloom/core";

// Where an item's own page is: under its PBI, or on the Tasks page for items without one.
export function itemPath(item: { id: string; pbiId: number | null }): string {
  return item.pbiId === null ? `/tasks/${item.id}` : `/pbis/${item.pbiId}/items/${item.id}`;
}

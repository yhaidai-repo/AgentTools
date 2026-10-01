const OPEN_STATUSES = ["open", "in-progress"];

export function isOpen(item: { status: string }): boolean {
  return OPEN_STATUSES.includes(item.status);
}

// Where an item's own page is: under its PBI, or on the Tasks page for items without one.
export function itemPath(item: { id: string; pbiId: number | null }): string {
  return item.pbiId === null ? `/tasks/${item.id}` : `/pbis/${item.pbiId}/items/${item.id}`;
}

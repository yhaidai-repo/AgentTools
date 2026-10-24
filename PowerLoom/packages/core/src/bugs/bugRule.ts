// QA reports an implementation bug as a Task under the PBI with [BUG] in its title (user decision 2026-10-09).
export const BUG_MARKER = "[BUG]";

export const BUG_WORK_ITEM_TYPE = "Task";

export function isMarkedBug(type: string, title: string): boolean {
  return type === BUG_WORK_ITEM_TYPE && hasBugMarker(title);
}

// A reported bug's title carries the marker like QA's, so both read the same everywhere.
export function bugTitle(title: string): string {
  return hasBugMarker(title) ? title : `${BUG_MARKER} ${title}`;
}

function hasBugMarker(title: string): boolean {
  return title.toUpperCase().includes(BUG_MARKER);
}

import type { BacklogGroup } from "../models/BacklogGroup";
import type { BacklogRow } from "../models/BacklogRow";

// Every row under its parent, latest change first, then priority (user decision 2026-10-18). A group shows when its
// parent or one of its children matches; the children shown are the matching ones. A child whose parent isn't listed
// stands on its own. A group sorts by its latest change, its parent's or a child's.
export function groupBacklogRows(rows: BacklogRow[], matches: (row: BacklogRow) => boolean): BacklogGroup[] {
  const listedIds = new Set(rows.map((row) => row.adoId));
  const isTopLevel = (row: BacklogRow) => row.parentId === null || !listedIds.has(row.parentId);
  const groups = rows.filter(isTopLevel).map((parent) => toGroup(parent, rows, matches));

  return groups.filter((group) => group.parentMatches || group.children.length > 0).sort(byGroupChange);
}

// The latest change in the group: a child's work moves its PBI up too.
export function groupChangedAt(group: BacklogGroup): Date {
  return new Date(Math.max(group.parent.changedAt.getTime(), ...group.children.map((child) => child.changedAt.getTime())));
}

function toGroup(parent: BacklogRow, rows: BacklogRow[], matches: (row: BacklogRow) => boolean): BacklogGroup {
  const children = rows.filter((row) => row.parentId === parent.adoId && matches(row)).sort(byRowChange);

  return { parent, parentMatches: matches(parent), children };
}

function byGroupChange(a: BacklogGroup, b: BacklogGroup): number {
  return groupChangedAt(b).getTime() - groupChangedAt(a).getTime() || byPriority(a.parent, b.parent);
}

function byRowChange(a: BacklogRow, b: BacklogRow): number {
  return b.changedAt.getTime() - a.changedAt.getTime() || byPriority(a, b);
}

// Priority 1 is the highest; a row without one goes last.
function byPriority(a: BacklogRow, b: BacklogRow): number {
  return (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER);
}

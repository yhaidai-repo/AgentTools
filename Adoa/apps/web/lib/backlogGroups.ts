import type { BacklogGroup } from "@/models/BacklogGroup";
import type { BacklogRow } from "@/models/BacklogRow";

// Every row under its parent, in the order given. A group shows when its parent or one of its children matches; the
// children shown are the matching ones. A child whose parent isn't listed stands on its own.
export function groupBacklogRows(rows: BacklogRow[], matches: (row: BacklogRow) => boolean): BacklogGroup[] {
  const listedIds = new Set(rows.map((row) => row.adoId));
  const isTopLevel = (row: BacklogRow) => row.parentId === null || !listedIds.has(row.parentId);
  const groups = rows.filter(isTopLevel).map((parent) => toGroup(parent, rows, matches));

  return groups.filter((group) => group.parentMatches || group.children.length > 0);
}

function toGroup(parent: BacklogRow, rows: BacklogRow[], matches: (row: BacklogRow) => boolean): BacklogGroup {
  const children = rows.filter((row) => row.parentId === parent.adoId && matches(row));

  return { parent, parentMatches: matches(parent), children };
}

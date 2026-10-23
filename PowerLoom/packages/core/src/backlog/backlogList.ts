import type { BacklogGroup } from "../models/BacklogGroup";
import type { BacklogListFilter } from "../models/BacklogListFilter";
import type { BacklogListRow } from "../models/BacklogListRow";
import type { BacklogRow } from "../models/BacklogRow";
import { groupBacklogRows } from "./backlogGroups";

// The rows pbi.list answers, in the Backlog page's order: grouped under their parent by latest change, each group's
// matching parent first, then its matching children. A parent the page shows only as a child's context is left out.
export function listBacklogRows(rows: BacklogRow[], filter: BacklogListFilter): BacklogRow[] {
  const matches = (row: BacklogRow) => matchesStatus(row, filter.status) && matchesSearch(row, filter.search);

  return groupBacklogRows(rows, matches).flatMap(matchingRows);
}

export function toBacklogListRow(row: BacklogRow): BacklogListRow {
  const listed: BacklogListRow = {
    adoId: row.adoId,
    title: row.title,
    type: row.type,
    adoState: row.adoState,
    pipelineStatus: row.pipelineStatus,
    sprint: row.iterationPath,
    openForYou: row.openForYou,
    findingsToReview: row.findingsToReview,
    bugSource: row.bugSource,
    changedAt: row.changedAt,
  };

  return row.parentId === null ? listed : { ...listed, parentId: row.parentId };
}

function matchingRows(group: BacklogGroup): BacklogRow[] {
  return group.parentMatches ? [group.parent, ...group.children] : group.children;
}

function matchesStatus(row: BacklogRow, status: string | undefined): boolean {
  return !status || row.pipelineStatus === status;
}

// A substring of the title (any case) or of the id, as typed: "385" finds PBI-38519.
function matchesSearch(row: BacklogRow, search: string | undefined): boolean {
  const term = (search ?? "").trim().toLowerCase();

  if (term === "") {
    return true;
  }

  return row.title.toLowerCase().includes(term) || String(row.adoId).includes(term);
}

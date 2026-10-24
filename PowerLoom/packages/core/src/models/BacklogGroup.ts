import type { BacklogRow } from "./BacklogRow";

// A top-level PBI with its child items, as the Backlog groups them (user decision 2026-10-09). A parent that doesn't
// match the status filter is shown only as the context of a child that does.
export interface BacklogGroup {
  parent: BacklogRow;
  parentMatches: boolean;
  children: BacklogRow[];
}

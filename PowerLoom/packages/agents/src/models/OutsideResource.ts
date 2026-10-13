import type { DataAccessKind } from "@powerloom/db";

export type { DataAccessKind };

// Where a tool call reads: the resource's name as Settings shows it, and what it points at.
export interface OutsideResource {
  kind: DataAccessKind;
  resource: string;
  target: string;
}

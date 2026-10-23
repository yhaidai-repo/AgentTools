import type { BacklogRow } from "./BacklogRow";

// One PBI as pbi.list answers it: the Backlog row's columns a chat reads, without the PBI's texts (pbi.read gives those).
export interface BacklogListRow {
  adoId: number;
  title: string;
  type: string;
  adoState: string;
  pipelineStatus: BacklogRow["pipelineStatus"];
  /** The iteration path, as the row has it. */
  sprint: string | null;
  openForYou: number;
  findingsToReview: number;
  bugSource: BacklogRow["bugSource"];
  changedAt: Date;
  /** Only for a child item: the PBI it is worked on under. */
  parentId?: number;
}

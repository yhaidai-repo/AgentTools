// A PBI created in adoa itself (user decision 2026-10-06), for vaults without an ADO integration or for work ADO
// doesn't track; it has no ADO counterpart and the sync leaves it alone.
export interface NewPbi {
  vault: string;
  title: string;
  type: string; // Product Backlog Item | Bug | Task
  priority: number;
  descriptionMd: string | null;
  acceptanceCriteriaMd: string | null;
}

export interface ItemNote {
  id: string;
  kind: string;
  adoId: number;
  parentId: string | null;
  title: string;
  status: string;
  assignee: string;
  body: string | null;
  data: Record<string, unknown> | null;
  runId: number | null;
  created: Date;
  updated: Date;
}

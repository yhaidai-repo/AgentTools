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
  /** The person's answer (question) or outcome note (human task). */
  resolution: string | null;
  /** Vault file names of the attachments uploaded with the answer. */
  attachments: string[];
  runId: number | null;
  created: Date;
  updated: Date;
}

export interface PbiNote {
  adoId: number;
  title: string;
  type: string;
  adoState: string;
  adoUrl: string;
  pipelineStatus: string;
  iterationPath: string | null;
  areaPath: string | null;
  assignedTo: string | null;
  priority: number | null;
  tags: string[];
  descriptionMd: string | null;
  acceptanceCriteriaMd: string | null;
  parentId: number | null; // the PBI this item is a child of
  created: Date;
  updated: Date;
}

export interface MappedWorkItem {
  adoId: number;
  rev: number;
  type: string;
  title: string;
  adoState: string;
  iterationPath: string | null;
  areaPath: string | null;
  assignedTo: string | null;
  priority: number | null;
  backlogPriority: number | null;
  effort: number | null;
  remainingWork: number | null;
  tags: string[];
  adoCreatedAt: Date | null;
  adoChangedAt: Date | null;
  descriptionMd: string;
  acceptanceCriteriaMd: string;
  contentHash: string;
}

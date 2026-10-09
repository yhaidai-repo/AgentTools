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
  adoParentId: number | null; // ADO's System.Parent; a child in adoa only when that parent is a PBI adoa has
  tags: string[];
  adoCreatedAt: Date | null;
  adoChangedAt: Date | null;
  descriptionMd: string;
  acceptanceCriteriaMd: string;
  contentHash: string;
}

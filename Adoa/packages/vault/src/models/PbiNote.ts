export interface PbiNote {
  adoId: number;
  title: string;
  type: string;
  adoState: string;
  adoUrl: string;
  pipelineStatus: string;
  outOfScope: boolean;
  iterationPath: string | null;
  isSprintKnown: boolean;
  areaPath: string | null;
  assignedTo: string | null;
  priority: number | null;
  effort: number | null;
  tags: string[];
  descriptionHtml: string;
  acceptanceCriteriaHtml: string;
  created: Date;
  updated: Date;
}

export interface IndexRow {
  adoId: number;
  title: string;
  adoState: string;
  pipelineStatus: string;
  iterationPath: string | null;
  outOfScope: boolean;
}

import type { PipelineStatus } from "./PipelineStatus";

// The PBI a child item is filed under.
export interface ParentPbi {
  adoId: number;
  title: string;
  vault: string;
  pipelineStatus: PipelineStatus;
}

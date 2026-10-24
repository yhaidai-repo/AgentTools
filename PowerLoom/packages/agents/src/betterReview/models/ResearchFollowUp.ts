// A research task an earlier run of this review created, with its result once there is one.
export interface ResearchFollowUp {
  taskId: string;
  title: string;
  status: string;
  resultId: string | null;
  conclusion: string | null;
}

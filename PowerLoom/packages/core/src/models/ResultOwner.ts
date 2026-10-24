// The PBI and the task an agent result belongs to; either is null when the result has none.
export interface ResultOwner {
  pbiId: number | null;
  taskId: string | null;
}

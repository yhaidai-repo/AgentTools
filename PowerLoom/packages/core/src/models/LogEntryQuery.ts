/** Which recorded warnings and errors to read, newest first. */
export interface LogEntryQuery {
  since: Date;
  service?: string | null;
  level?: "warn" | "error" | null;
  runId?: number | null;
  taskId?: string | null;
  search?: string | null;
  limit: number;
}

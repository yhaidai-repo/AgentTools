/** A warning or error to record, with what it is about when the writer knows. */
export interface NewLogEntry {
  service: string;
  level: "warn" | "error";
  message: string;
  runId?: number | null;
  taskId?: string | null;
  pbiId?: number | null;
  vault?: string | null;
}

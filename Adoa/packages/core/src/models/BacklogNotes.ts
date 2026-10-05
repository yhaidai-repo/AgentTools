// A read-only view of the rendered backlog vault; paths are relative to its BACKLOG_FOLDER. Only the worker writes it.
export interface BacklogNotes {
  exists(backlogRelativePath: string): Promise<boolean>;
}

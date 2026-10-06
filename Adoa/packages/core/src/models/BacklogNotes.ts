// A read-only view of the rendered backlog; paths are relative to the vault's backlog folder. Only the worker writes it.
export interface BacklogNotes {
  exists(vault: string, backlogRelativePath: string): Promise<boolean>;
}

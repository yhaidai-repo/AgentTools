// The sandbox's files as the patch and edit code sees them; paths are already checked to be in the workspace.
export interface FileStore {
  /** The file's text, or null when it doesn't exist. */
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
}

// The docs vault as the tech-writer may change it; the runner provides it (path-guarded, never draft/ or root files).
export interface DocsVault {
  readNote(path: string): Promise<string | null>;
  writeNote(path: string, content: string): Promise<void>;
  removeFile(path: string): Promise<void>;
}

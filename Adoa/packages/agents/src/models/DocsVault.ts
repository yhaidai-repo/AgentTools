// The docs vault as the tech-writer may change it; the runner provides it (path-guarded, never backlog/).
export interface DocsVault {
  writeNote(path: string, content: string): Promise<void>;
  removeFile(path: string): Promise<void>;
}

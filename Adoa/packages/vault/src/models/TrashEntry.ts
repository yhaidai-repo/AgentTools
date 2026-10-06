// A file in a vault's `.trash/`; the path is where it was in the vault.
export interface TrashEntry {
  path: string;
  sizeBytes: number;
  modifiedAt: Date;
}

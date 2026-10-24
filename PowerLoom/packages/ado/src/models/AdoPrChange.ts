// A file a PR changes, as of one iteration: changeType is ADO's (add, edit, delete, rename, or combinations).
export interface AdoPrChange {
  path: string;
  changeType: string;
  originalPath: string | null;
}

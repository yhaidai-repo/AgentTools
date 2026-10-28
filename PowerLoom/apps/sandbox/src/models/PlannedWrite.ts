// One file change of a patch, worked out before anything is written: content null removes the file.
export interface PlannedWrite {
  path: string;
  content: string | null;
}

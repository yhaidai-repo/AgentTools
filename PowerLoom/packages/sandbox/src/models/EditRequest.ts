export interface EditRequest {
  path: string;
  oldString: string;
  newString: string;
  /** Replace every match; without it the old text must match exactly once. */
  replaceAll: boolean;
}

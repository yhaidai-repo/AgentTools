// What a docs task the user created stores (local_item.data; user decision 2026-10-15): no draft and no note, only the
// vault; the task's body is the request and `doneWhen` its acceptance criteria. The tech-writer finds the notes itself.
export interface RequestTaskData {
  key: string;
  mode: "request";
  /** Folder name under the vaults root, e.g. work-projects. */
  vault: string;
}

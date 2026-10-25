// What the drafts job stores on a tech-writer task (local_item.data).
export interface DraftTaskData {
  draft: string;
  /** Relative to the docs vault, e.g. draft/pos-topic.md. */
  path: string;
  project: string;
  target: string;
  source: string;
  captured: string;
}

import type { CommentUpdateDraft } from "./CommentUpdateDraft";
import type { NewCommentDraft } from "./NewCommentDraft";

// Filled by the code-review tools during the run; written to the DB only when the run succeeds.
export interface ReviewDraft {
  summary: string | null;
  comments: NewCommentDraft[];
  updates: CommentUpdateDraft[];
}

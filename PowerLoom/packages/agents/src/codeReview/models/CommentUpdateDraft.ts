import type { CommentAnchor } from "./CommentAnchor";

// What the agent decided about an earlier comment (usually one the user answered): take it back, keep it, or reword it;
// Better Review's follow-up also marks it fixed, and moves a kept comment to the lines it is on now.
export interface CommentUpdateDraft {
  id: string;
  action: "withdraw" | "keep" | "refine" | "fixed";
  /** The agent's reply to the user's answer, shown under it. */
  reply: string;
  /** The new comment text, for refine. */
  body: string | null;
  /** Better Review: the comment's lines in the commit reviewed now, when its code moved; null keeps the old ones. */
  anchor?: CommentAnchor | null;
}

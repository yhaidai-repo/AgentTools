// What the agent decided about an earlier comment (usually one the user answered): take it back, keep it, or reword it.
export interface CommentUpdateDraft {
  id: string;
  action: "withdraw" | "keep" | "refine";
  /** The agent's reply to the user's answer, shown under it. */
  reply: string;
  /** The new comment text, for refine. */
  body: string | null;
}

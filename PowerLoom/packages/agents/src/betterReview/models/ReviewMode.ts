// Full: the whole PR diff (first review, or the last reviewed commit is gone). Follow-up: what changed since the commit
// the last review saw, anchored to it (user decision 2026-10-16: after the comments are fixed, review the fixes, not
// the whole PR again).
export type ReviewMode =
  | { kind: "full"; reason: string }
  | { kind: "follow-up"; baseCommit: string };

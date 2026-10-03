import type { reviewSeverity } from "@adoa/db";

// A comment the agent added this run; the snippet is the code under it, read from the PR's commit when it was added.
export interface NewCommentDraft {
  path: string;
  startLine: number;
  endLine: number;
  severity: (typeof reviewSeverity.enumValues)[number];
  body: string;
  snippet: string;
  snippetStartLine: number;
}

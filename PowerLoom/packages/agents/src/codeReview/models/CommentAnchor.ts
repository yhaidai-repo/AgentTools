// Where a comment sits: the commit, its new-side lines and the code under them as read then.
export interface CommentAnchor {
  commit: string;
  startLine: number;
  endLine: number;
  snippet: string;
  snippetStartLine: number;
}

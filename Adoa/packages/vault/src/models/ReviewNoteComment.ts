// One review comment in a PR's review note; the code is the snippet as reviewed.
export interface ReviewNoteComment {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  severity: string;
  status: string;
  bodyMd: string;
  codeSnippet: string;
  snippetStartLine: number;
  answerMd: string | null;
  agentReplyMd: string | null;
}

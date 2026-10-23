// Who is reading: the identity for the data access log, one per run (built from the task and the session) or per
// chat session (user decision 2026-10-24: a chat session is not a run, so it has no run id).
export interface OutsideAccessContext {
  vault: string;
  agentId: string;
  /** The run the call belongs to; null in a chat session. */
  runId: number | null;
  /** Who owns what a call starts outside (a DevHub stack, a browser case): `powerloom-run-<id>` or `powerloom-chat-<session>`. */
  owner: string;
  taskId: string | null;
  pbiId: number | null;
}

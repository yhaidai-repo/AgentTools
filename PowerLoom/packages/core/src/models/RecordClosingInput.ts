// Closes an open register record (KI, OQ or WWW) a chat settled with the user.
export interface RecordClosingInput {
  path: string;
  id: string;
  status: "fixed" | "resolved" | "duplicate";
  duplicateOf: { path: string; id: string } | null;
  decision: string;
  decidedBy: string;
}

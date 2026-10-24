import type { ResultKind } from "./ResultKind";

// One result version as result.versions answers it: the kind and id to pass to result.get, who wrote it and when.
export interface ResultVersionSummary {
  kind: ResultKind;
  id: string;
  label: string;
  runId: number | null;
  agent: string | null;
  createdAt: Date;
  status: string | null;
  isLatest: boolean;
}

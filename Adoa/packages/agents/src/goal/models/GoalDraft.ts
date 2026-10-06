import type { FindingDraft } from "../../techWriter/models/FindingDraft";

// What a goal run produces before its commit: the written result and the findings it recorded.
export interface GoalDraft {
  result: string | null;
  findings: FindingDraft[];
}

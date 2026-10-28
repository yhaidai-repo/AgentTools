import type { RecordWorkContext } from "@powerloom/vault";
// What the tech-writer stores on a finding (local_item.data).
export interface FindingData {
  context?: RecordWorkContext;
  type: "question" | "issue";
  project: string;
  default?: string[];
  options?: string[];
}

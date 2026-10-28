import type { RecordWorkContext } from "@powerloom/vault";
// A record for a project's register: an open question or a known issue.
export interface RegisterRecordInput {
  context?: RecordWorkContext;
  project: string;
  kind: "questions" | "issues";
  title: string;
  text: string;
  default: string[];
  options: string[];
}

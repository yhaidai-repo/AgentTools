import type { RecordWorkContext } from "@powerloom/vault";
// The user's "Submit to vault" on a finding, with their edits to what the tech-writer drafted.
export interface SubmitFindingRequest {
  context?: RecordWorkContext;
  itemId: string;
  adoId: number | null;
  type: "question" | "issue";
  project: string;
  title: string | null;
  text: string | null;
  default: string[];
  options: string[];
}

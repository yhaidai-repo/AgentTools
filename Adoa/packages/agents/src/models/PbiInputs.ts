import type { AttachmentSummary } from "./AttachmentSummary";
import type { ClosedHumanItem } from "./ClosedHumanItem";

// What the user added to a PBI in adoa: uploads, answers and finished human tasks.
export interface PbiInputs {
  attachments: AttachmentSummary[];
  closedItems: ClosedHumanItem[];
}

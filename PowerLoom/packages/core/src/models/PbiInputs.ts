import type { AttachmentSummary } from "./AttachmentSummary";
import type { ExistingItem } from "./ExistingItem";

// What the PBI already has beyond its note: the user's uploads, and every question and task (open or closed).
export interface PbiInputs {
  attachments: AttachmentSummary[];
  items: ExistingItem[];
}

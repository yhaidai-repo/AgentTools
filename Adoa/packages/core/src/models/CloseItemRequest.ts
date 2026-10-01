export type CloseDecision = "answer" | "dismiss" | "done" | "cancel";

// A person closing a question or human task in the web UI.
export interface CloseItemRequest {
  itemId: string;
  adoId: number;
  decision: CloseDecision;
  resolution: string | null;
  hasAttachment: boolean;
}

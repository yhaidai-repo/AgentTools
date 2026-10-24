// A question or task the PBI already has (any status), as the agents' first message lists it.
export interface ExistingItem {
  id: string;
  kind: string;
  status: string;
  text: string;
  /** The person's answer or outcome note, if any. */
  resolution: string | null;
  attachmentIds: string[];
}

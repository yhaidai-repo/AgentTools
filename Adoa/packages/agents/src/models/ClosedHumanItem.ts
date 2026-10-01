// A question or human task the user closed, with their answer or outcome note.
export interface ClosedHumanItem {
  id: string;
  kind: string;
  status: string;
  title: string;
  resolution: string | null;
  attachmentIds: string[];
}

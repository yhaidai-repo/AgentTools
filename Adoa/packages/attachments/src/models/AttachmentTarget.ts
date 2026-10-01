// What an upload belongs to: always a PBI, optionally the item it answers and the linked document it replaces.
export interface AttachmentTarget {
  adoId: number;
  itemId: string | null;
  sourceUrl: string | null;
}

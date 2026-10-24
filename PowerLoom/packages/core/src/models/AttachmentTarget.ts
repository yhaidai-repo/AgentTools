// What stored files answer: an item's question, or a linked document they replace; both null for the PBI itself.
export interface AttachmentTarget {
  itemId: string | null;
  sourceUrl: string | null;
}

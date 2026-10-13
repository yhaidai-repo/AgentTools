// What the first message says about one upload; the text itself is read with read_attachment.
export interface AttachmentSummary {
  id: string;
  fileName: string;
  sourceUrl: string | null;
  itemId: string | null;
  textChars: number | null;
}

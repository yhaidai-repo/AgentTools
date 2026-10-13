// A long document is read in pages, so it can't flood the context (read_attachment, fetch_document).
export const PAGE_CHARS = 30_000;

export function textPage(text: string, offset: number): string {
  const end = Math.min(offset + PAGE_CHARS, text.length);
  const footer = end < text.length ? `[${end} of ${text.length} chars; continue with offset ${end}]` : `[end, ${text.length} chars]`;

  return `${text.slice(offset, end)}\n\n${footer}`;
}

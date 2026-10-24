// text is null for files agents can't read yet (images); a file that should have text but has none is rejected.
export type ExtractedText =
  | { ok: true; text: string | null }
  | { ok: false; error: string };

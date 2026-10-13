import type { SplitNote } from "./models/SplitNote";

const NOTES_HEADING = "## Notes";
const EMPTY_NOTES = `${NOTES_HEADING}\n`;
const NOTES_LINE = /^## Notes[ \t]*$/m;

// `## Notes` is the only human-owned part of a note; it must survive every re-render.
export function extractNotesSection(existing: string | null): string {
  if (!existing) {
    return EMPTY_NOTES;
  }

  const start = existing.search(NOTES_LINE);

  if (start < 0) {
    return EMPTY_NOTES;
  }

  return existing.slice(start).trimEnd() + "\n";
}

// The generated part of a note and the user's text under `## Notes` (without the heading).
export function splitNotesSection(note: string): SplitNote {
  const start = note.search(NOTES_LINE);

  if (start < 0) {
    return { generated: note.trim(), userNotes: "" };
  }

  return { generated: note.slice(0, start).trim(), userNotes: note.slice(start).replace(NOTES_LINE, "").trim() };
}

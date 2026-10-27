import type { SplitNote } from "./models/SplitNote";

const NOTES_HEADING = "## Notes";
export const USER_NOTES_MARKER = "<!-- powerloom:user-notes -->";
const EMPTY_NOTES = `${NOTES_HEADING}\n`;
// A heading line, also with a Windows line ending.
const NOTES_LINE = /^## Notes[ \t]*\r?$/m;
// Empty `## Notes` headings stacked above the last one (left by a template saved on Windows): one heading stays.
const REPEATED_HEADINGS = /^(?:## Notes[ \t]*\r?\n\s*)+(?=## Notes[ \t]*\r?(?:\n|$))/;

export function appendUserNotes(generated: string, notesSection: string): string {
  return `${generated.replaceAll(USER_NOTES_MARKER, "").trimEnd()}\n\n${USER_NOTES_MARKER}\n${notesSection}`;
}

// `## Notes` is the only human-owned part of a note; it must survive every re-render.
export function extractNotesSection(existing: string | null): string {
  if (!existing) {
    return EMPTY_NOTES;
  }

  const marker = existing.indexOf(USER_NOTES_MARKER);
  const content = marker < 0 ? existing : existing.slice(marker + USER_NOTES_MARKER.length);
  const start = content.search(NOTES_LINE);

  if (start < 0) {
    return EMPTY_NOTES;
  }

  return content.slice(start).replace(REPEATED_HEADINGS, "").trimEnd() + "\n";
}

// The generated part of a note and the user's text under `## Notes` (without the heading).
export function splitNotesSection(note: string): SplitNote {
  const marker = note.indexOf(USER_NOTES_MARKER);
  const start = marker < 0 ? note.search(NOTES_LINE) : marker;

  if (start < 0) {
    return { generated: note.trim(), userNotes: "" };
  }

  return { generated: note.slice(0, start).trim(), userNotes: extractNotesSection(note).replace(NOTES_LINE, "").trim() };
}

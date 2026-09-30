const NOTES_HEADING = "## Notes";
const EMPTY_NOTES = `${NOTES_HEADING}\n`;

// `## Notes` is the only human-owned part of a note; it must survive every re-render.
export function extractNotesSection(existing: string | null): string {
  if (!existing) {
    return EMPTY_NOTES;
  }

  const start = existing.search(/^## Notes[ \t]*$/m);

  if (start < 0) {
    return EMPTY_NOTES;
  }

  return existing.slice(start).trimEnd() + "\n";
}

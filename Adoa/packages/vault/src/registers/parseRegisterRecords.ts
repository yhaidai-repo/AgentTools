import type { RegisterNoteRecord } from "../models/RegisterNoteRecord";

const RECORD_HEADING = /^## (\[RESOLVED\] )?([A-Z]+-\d+)\b[ \t]*(.*)$/gm;
const BOLD_LINE = /^\*\*(.+)\*\*\s*$/m;
const METADATA_STATUS = /^> \*\*(\w+)\*\*/m;
const OPEN_STATUS = "open";

// The records of a register note. Both layouts are read: the title in the heading (`## [RESOLVED] OQ-001 Title`), and
// the older one with the title as a bold line under `## OQ-001`. The same layouts VaultCapture's `register` reads.
export function parseRegisterRecords(noteText: string): RegisterNoteRecord[] {
  const headings = [...noteText.matchAll(RECORD_HEADING)];

  return headings.map((heading, index) => toRecord(heading, noteText.slice(heading.index + heading[0].length, headings[index + 1]?.index)));
}

function toRecord(heading: RegExpMatchArray, body: string): RegisterNoteRecord {
  const status = METADATA_STATUS.exec(body)?.[1] ?? "";
  const markedResolved = heading[1] !== undefined;

  return {
    id: heading[2],
    title: heading[3].trim() || BOLD_LINE.exec(body)?.[1] || "",
    status,
    resolved: markedResolved || (status !== "" && status.toLowerCase() !== OPEN_STATUS),
    created: dateAfter(body, "Created"),
    updated: dateAfter(body, "Updated"),
  };
}

function dateAfter(body: string, label: string): string | null {
  return new RegExp(`${label}:? (\\d{4}-\\d{2}-\\d{2})`).exec(body)?.[1] ?? null;
}

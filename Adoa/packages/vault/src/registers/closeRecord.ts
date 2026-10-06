import type { MaintenanceRecord } from "../models/MaintenanceRecord";
import type { RecordClosingEdit } from "../models/RecordClosingEdit";
import { withWwwStats } from "../www/wwwLog";

const NOT_RESOLVED_HEADING = /^## (?!\[RESOLVED\] )/;
const METADATA_LINE = /^> \*\*\w+\*\*(?:\s*\([^)]*\))?/m;
const UPDATED_DATE = /Updated:? \d{4}-\d{2}-\d{2}/;
const BOLD_TITLE = /^\*\*.+\*\*\s*$/;
const WWW_STATUS = /^- Status:.*$/m;
const WWW_UPDATED = /^(- Created: [^·\r\n]*· Updated: ).*$/m;
const WWW_RESOLUTION = /^- Resolution:[ \t]*(.*)$/m;
const EMPTY_FIELDS = ["", "–", "-"];

// Closes one record of a register note the way the vault rules say, and returns the whole note. KI/OQ: `[RESOLVED]` in
// the heading, the new status in the metadata line, `Updated` bumped, a **Decision** block. WWW: `Status: resolved`,
// `Updated` bumped, the decision in `Resolution`, statistics recalculated (the www-record skill's update_stats).
export function closeRecord(noteText: string, record: MaintenanceRecord, closing: RecordClosingEdit, today: string): string {
  const eol = noteText.includes("\r\n") ? "\r\n" : "\n";

  if (record.kind === "www") {
    return withWwwStats(noteText.replace(record.text, () => closedWwwRecord(record.text, closing, today)));
  }

  return noteText.replace(record.text, () => closedRegisterRecord(record.text, closing, today, eol));
}

function closedRegisterRecord(text: string, closing: RecordClosingEdit, today: string, eol: string): string {
  const [heading, ...body] = text.split(eol);
  const metadata = `> **${closing.status}**`;
  const updated = METADATA_LINE.test(text) ? body.join(eol).replace(METADATA_LINE, metadata).replace(UPDATED_DATE, `Updated ${today}`) : withMetadataLine(body, `${metadata} · Updated ${today}`, eol);
  const decision = `**Decision** (${closing.decidedBy}): ${closing.decision}`;

  // The blank line keeps the block out of a list the record ends with (Markdown would continue the last item).
  return [heading.replace(NOT_RESOLVED_HEADING, "## [RESOLVED] "), updated, "", decision].join(eol);
}

// A record without a metadata line gets one right under its title (the heading, or the older bold title line).
function withMetadataLine(body: string[], metadataLine: string, eol: string): string {
  const titleLines = BOLD_TITLE.test(body[0] ?? "") ? 1 : 0;

  return [...body.slice(0, titleLines), metadataLine, ...body.slice(titleLines)].join(eol);
}

function closedWwwRecord(text: string, closing: RecordClosingEdit, today: string): string {
  return text
    .replace(WWW_STATUS, "- Status: resolved")
    .replace(WWW_UPDATED, (_line, prefix: string) => `${prefix}${today}`)
    .replace(WWW_RESOLUTION, (_line, current: string) => `- Resolution: ${withResolution(current.trim(), closing)}`);
}

function withResolution(current: string, closing: RecordClosingEdit): string {
  const added = `${closing.decision} (${closing.decidedBy})`;

  return EMPTY_FIELDS.includes(current) ? added : `${current}; ${added}`;
}

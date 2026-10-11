import type { WwwEntry } from "../models/WwwEntry";
import type { WwwRecord } from "../models/WwwRecord";

const RECORD_HEADING = /^## WWW-(\d+)\b/gm;
const STATS_BLOCK = /<!-- stats:start -->[\s\S]*?<!-- stats:end -->/;
const EMPTY = "–";

// Appends a record to a www-log.md with the next free id (never reused) and recalculates its statistics, as the
// www-record skill does (its update_stats.py, ported).
export function appendWwwRecord(logText: string, entry: WwwEntry, today: string): { text: string; recordId: string } {
  const recordId = `WWW-${String(lastRecordNumber(logText) + 1).padStart(3, "0")}`;
  const text = `${logText.trimEnd()}\n\n${renderRecord(recordId, entry, today)}\n`;

  return { text: withWwwStats(text), recordId };
}

// Every record of a www-log.md, in the log's order. The "Record format" sample (`## WWW-nnn`) isn't a record.
export function parseWwwRecords(logText: string): WwwRecord[] {
  const headings = [...logText.matchAll(/^## (WWW-\d+)\b[ \t]*(.*)$/gm)];

  return headings.map((heading, index) => toWwwRecord(heading, logText.slice(heading.index, headings[index + 1]?.index)));
}

function toWwwRecord(heading: RegExpMatchArray, record: string): WwwRecord {
  const dates = field(record, "Created").split("·").map((part) => part.replace("Updated:", "").trim());

  return {
    id: heading[1],
    title: heading[2].trim(),
    created: dates[0] ?? "",
    updated: dates[1] ?? dates[0] ?? "",
    kind: field(record, "Kind"),
    project: field(record, "Project"),
    fault: field(record, "Fault"),
    status: field(record, "Status"),
  };
}

function lastRecordNumber(logText: string): number {
  return Math.max(0, ...[...logText.matchAll(RECORD_HEADING)].map((match) => Number(match[1])));
}

function renderRecord(recordId: string, entry: WwwEntry, today: string): string {
  return [
    `## ${recordId} ${entry.title}`,
    `- Created: ${today} · Updated: ${today}`,
    `- Kind: ${entry.kind}`,
    `- Project: ${entry.project}`,
    `- Planned: ${oneLine(entry.planned)}`,
    `- Happened: ${oneLine(entry.happened)}`,
    `- Fault: ${entry.fault}`,
    `- Root cause: ${orEmpty(entry.rootCause)}`,
    `- Resolution: ${orEmpty(entry.resolution)}`,
    `- Preventive action: ${orEmpty(entry.preventiveAction)}`,
    `- Applied at: ${EMPTY}`,
    `- Status: ${entry.resolution ? "resolved" : "open"}`,
    `- Assumptions: ${entry.assumptions?.trim() ? oneLine(entry.assumptions) : "none"}`,
  ].join("\n");
}

export function withWwwStats(text: string): string {
  const records = text.split(/^## WWW-\d+/m).slice(1);
  const applied = records.filter((record) => isFilled(field(record, "Applied at"))).length;
  const withPrevention = records.filter((record) => isFilled(field(record, "Preventive action"))).length;
  const rows: [string, number][] = [
    ["Not as planned (total records)", records.length],
    ["Fault: Human", countField(records, "Fault", "Human")],
    ["Fault: Agent", countField(records, "Fault", "Agent")],
    ["Status: open", countField(records, "Status", "open")],
    ["Status: resolved", countField(records, "Status", "resolved")],
    ["Preventive action applied", applied],
    ["Preventive action proposed, not applied", withPrevention - applied],
  ];
  const table = ["| Metric | Count |", "|---|---|", ...rows.map(([metric, count]) => `| ${metric} | ${count} |`)].join("\n");

  return text.replace(STATS_BLOCK, `<!-- stats:start -->\n${table}\n<!-- stats:end -->`);
}

function field(record: string, name: string): string {
  return record.match(new RegExp(`^- ${name}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";
}

function countField(records: string[], name: string, value: string): number {
  return records.filter((record) => field(record, name).toLowerCase() === value.toLowerCase()).length;
}

function isFilled(value: string): boolean {
  return value !== "" && value !== EMPTY && value !== "-";
}

function orEmpty(value: string | null): string {
  return value?.trim() ? oneLine(value) : EMPTY;
}

// A record field is one list line.
function oneLine(value: string): string {
  return value.trim().replaceAll(/\s*\r?\n\s*/g, " ");
}

import type { MaintenanceRecord } from "../models/MaintenanceRecord";
import type { RegisterKind } from "../models/RegisterKind";
import { parseWwwRecords } from "../www/wwwLog";
import { parseRegisterRecords } from "./parseRegisterRecords";

const WWW_LOG_PATH = "www-log.md";
const PROJECT_REGISTERS: [suffix: string, kind: RegisterKind][] = [["known-issues", "issues"], ["open-questions", "questions"]];
const RECORD_HEADING = /^## (?:\[RESOLVED\] )?[A-Z]+-\d+\b/gm;
const NEXT_HEADING = /^#{1,2} /m;
const OPEN_WWW_STATUS = "open";

// The registers the vault review checks (user decision 2026-10-06): the vault's www-log.md and each project's
// `<key>/<key>-known-issues.md` and `<key>/<key>-open-questions.md`. Feature-local question files aren't registers.
export function registerKindOf(path: string): RegisterKind | null {
  if (path === WWW_LOG_PATH) {
    return "www";
  }

  const [project, file, ...deeper] = path.split("/");

  if (!file || deeper.length > 0) {
    return null;
  }

  return PROJECT_REGISTERS.find(([suffix]) => file === `${project}-${suffix}.md`)?.[1] ?? null;
}

// Every record of a register note, in the note's order; no records for any other note.
export function maintenanceRecords(path: string, noteText: string): MaintenanceRecord[] {
  const kind = registerKindOf(path);

  if (!kind) {
    return [];
  }

  return recordBlocks(noteText).map((text) => (kind === "www" ? wwwRecord(path, text) : registerRecord(kind, path, text)));
}

function recordBlocks(noteText: string): string[] {
  return [...noteText.matchAll(RECORD_HEADING)].map((heading) => blockFrom(noteText, heading.index));
}

// A record ends at the next `#`/`##` heading; `###` and deeper belong to it.
function blockFrom(noteText: string, start: number): string {
  const bodyStart = noteText.indexOf("\n", start) + 1;

  if (bodyStart === 0) {
    return noteText.slice(start);
  }

  const next = NEXT_HEADING.exec(noteText.slice(bodyStart));

  return noteText.slice(start, next ? bodyStart + next.index : undefined).trimEnd();
}

function wwwRecord(path: string, text: string): MaintenanceRecord {
  const record = parseWwwRecords(text)[0];

  return {
    kind: "www",
    path,
    id: record.id,
    title: record.title,
    status: record.status,
    isOpen: record.status.toLowerCase() === OPEN_WWW_STATUS,
    updated: record.updated || null,
    text,
  };
}

function registerRecord(kind: RegisterKind, path: string, text: string): MaintenanceRecord {
  const record = parseRegisterRecords(text)[0];

  return { kind, path, id: record.id, title: record.title, status: record.status, isOpen: !record.resolved, updated: record.updated, text };
}

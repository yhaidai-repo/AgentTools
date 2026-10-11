import { closeRecord, isLinkEditable, maintenanceRecords, withRecordLinksResolved, type RecordClosingEdit, type VaultIndex } from "@powerloom/vault";
import type { RecordClosing } from "./models/RecordClosing";
import type { RecordDecision } from "./models/RecordDecision";

const DECIDED_BY = "PowerLoom vault-review";

type ContentOf = (path: string) => string;

// The run's closed records (user decision 2026-10-06), written into the planned edits. A closed KI/OQ heading gets
// `[RESOLVED]`, so links to it are pointed at the register note, as the vault rules say.
export function closeRecords(index: VaultIndex, decisions: RecordDecision[], edits: Map<string, string>, contentOf: ContentOf, today: string): void {
  const closed = decisions.filter((decision) => decision.vault === index.vault && decision.action === "close");

  closed.forEach((decision) => closeOne(index, decision, edits, contentOf, today));
}

// The record was checked open in this scan when the tool staged it, so it is found.
function closeOne(index: VaultIndex, decision: RecordDecision, edits: Map<string, string>, contentOf: ContentOf, today: string): void {
  const content = contentOf(decision.path);
  const record = maintenanceRecords(decision.path, content).find((candidate) => candidate.id === decision.recordId);

  if (!record) {
    return;
  }

  edits.set(decision.path, closeRecord(content, record, closingEdit(index, decision, decision.closing!, today), today));

  if (record.kind !== "www") {
    linkingNotes(index, decision.path).forEach((from) => resolveLinksIn(from, decision, edits, contentOf));
  }
}

// The register itself is included: its own links to the record aren't inbound links.
function linkingNotes(index: VaultIndex, registerPath: string): Set<string> {
  const withHeading = index.linksTo(registerPath).filter((link) => link.heading !== null && isLinkEditable(link.from));

  return new Set([registerPath, ...withHeading.map((link) => link.from)]);
}

function resolveLinksIn(from: string, decision: RecordDecision, edits: Map<string, string>, contentOf: ContentOf): void {
  const content = contentOf(from);
  const resolved = withRecordLinksResolved(content, decision.path, decision.recordId);

  if (resolved !== content) {
    edits.set(from, resolved);
  }
}

function closingEdit(index: VaultIndex, decision: RecordDecision, closing: RecordClosing, today: string): RecordClosingEdit {
  const parts = [duplicateText(index, decision, closing), decision.reasons.trim(), evidenceText(index, decision, closing)];

  return {
    status: closing.status === "fixed" ? "Fixed" : "Resolved",
    decidedBy: `${DECIDED_BY}, ${today}`,
    decision: parts.filter(Boolean).join(" ").replaceAll(/\s*\r?\n\s*/g, " "),
  };
}

function duplicateText(index: VaultIndex, decision: RecordDecision, closing: RecordClosing): string {
  const original = closing.duplicateOf;

  if (!original) {
    return "";
  }

  const otherRegister = original.path === decision.path ? "" : ` (${noteLink(index, original.path)})`;

  return `Duplicate of ${original.id}${otherRegister}.`;
}

// The record's own register isn't linked: the evidence there is the record's neighbours.
function evidenceText(index: VaultIndex, decision: RecordDecision, closing: RecordClosing): string {
  const paths = [...new Set(closing.evidence.map((evidence) => evidence.path))].filter((path) => path !== decision.path);

  return paths.length > 0 ? `Evidence: ${paths.map((path) => noteLink(index, path)).join(", ")}.` : "";
}

function noteLink(index: VaultIndex, path: string): string {
  return `[[${index.note(path)?.name ?? path.replace(/\.md$/, "")}]]`;
}

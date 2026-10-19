import { maintenanceRecords, type MaintenanceRecord, type VaultIndex } from "@powerloom/vault";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { RecordClosing } from "./models/RecordClosing";
import type { RecordDecision } from "./models/RecordDecision";
import type { RecordEvidence } from "./models/RecordEvidence";
import type { RecordRef } from "./models/RecordRef";
import type { ReviewLimits } from "./models/ReviewLimits";
import type { VaultReviewDraft } from "./models/VaultReviewDraft";
import type { ReviewScope } from "./ReviewScope";

// Shorter quotes match by chance (an id, a status word).
const MIN_QUOTE_LENGTH = 12;

const recordInput = {
  vault: z.string().min(1).describe("Vault folder name, one of the run's vaults"),
  path: z.string().min(1).describe("The register note, relative to the vault root, as list_open_records shows it"),
  id: z.string().min(1).describe("The record id, e.g. KI-008, OQ-003, WWW-005"),
};
const recordRefInput = z.object({ path: z.string().min(1), id: z.string().min(1) });
const evidenceInput = z.object({
  path: z.string().min(1).describe("A note of the same vault, relative to its root"),
  quote: z.string().min(MIN_QUOTE_LENGTH).describe("The note's exact words that show the record is settled"),
});

type ToolText = { text: string; isError?: boolean };

// The vault review's register actions (user decision 2026-10-06): an open WWW/KI/OQ record is closed only on evidence the
// vault itself holds, else kept. They only fill the draft; a second call for the same record replaces the first.
export function createVaultReviewRecordTools(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits): ToolDefinition<any>[] {
  return [keepRecordTool(scope, draft, limits), closeRecordTool(scope, draft, limits)];
}

function keepRecordTool(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits) {
  return defineTool({
    name: "keep_record",
    description: "Keep an open record open: no note of the vault records its fix, answer or decision, and no other record repeats it. It isn't offered again for a while unless its Updated date moves.",
    input: { ...recordInput, reasons: z.string().min(1).describe("What you searched the vault for, in 1-2 lines") },
    handler: async (input) => stage(scope, draft, limits, { vault: input.vault, path: input.path, recordId: input.id, action: "keep", reasons: input.reasons, closing: null }),
    replayOnResume: true,
  });
}

function closeRecordTool(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits) {
  return defineTool({
    name: "close_record",
    description: [
      "Close an open record the vault already settles: fixed (known issues: a note records the fix), resolved (a note records the answer, decision or fix; WWW: its resolution is recorded), or duplicate (another record holds the same issue or question).",
      "Evidence is vault content only: quote the notes' exact words; code, PBIs you can't see in the vault and your own reasoning don't count.",
      "Written as the vault rules say: KI/OQ get [RESOLVED] in the heading, the status, Updated and a Decision line; WWW gets Status: resolved and the decision in Resolution.",
    ].join(" "),
    input: {
      ...recordInput,
      status: z.enum(["fixed", "resolved", "duplicate"]),
      duplicateOf: recordRefInput.nullable().default(null).describe("Duplicate only: the record it repeats (register path and id)"),
      decision: z.string().min(1).describe("One line written into the record: what settled it, with the dates, PBIs or commits the evidence names"),
      evidence: z.array(evidenceInput).min(1),
    },
    handler: async (input) => {
      const closing: RecordClosing = { status: input.status, duplicateOf: input.duplicateOf, evidence: input.evidence };

      return stage(scope, draft, limits, { vault: input.vault, path: input.path, recordId: input.id, action: "close", reasons: input.decision, closing });
    },
    replayOnResume: true,
  });
}

async function stage(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits, decision: RecordDecision): Promise<ToolText> {
  if (!scope.hasVault(decision.vault)) {
    return { text: `Unknown vault "${decision.vault}"; this run reviews: ${scope.vaults.join(", ")}.`, isError: true };
  }

  const index = await scope.index(decision.vault);
  const record = (await scope.candidates(decision.vault)).records.find((candidate) => candidate.path === decision.path && candidate.id === decision.recordId);
  const problem = record ? decisionProblem(index, draft, limits, record, decision) : `${decision.path} has no open record ${decision.recordId}; list_open_records shows them.`;

  if (problem) {
    return { text: `Not noted: ${problem}`, isError: true };
  }

  draft.records = [...draft.records.filter((other) => !isSameRecord(other, decision)), decision];

  return { text: `${decision.action} ${decision.path} ${decision.recordId} noted (${draft.records.length} of ${limits.maxRecordsPerRun} records).` };
}

function decisionProblem(index: VaultIndex, draft: VaultReviewDraft, limits: ReviewLimits, record: MaintenanceRecord, decision: RecordDecision): string | null {
  const isNew = !draft.records.some((other) => isSameRecord(other, decision));

  if (isNew && draft.records.length >= limits.maxRecordsPerRun) {
    return `this run's cap of ${limits.maxRecordsPerRun} records is reached; write the summary, the next run goes on.`;
  }

  return decision.closing ? (statusProblem(index, record, decision.closing) ?? evidenceProblem(index, decision.closing.evidence)) : null;
}

function statusProblem(index: VaultIndex, record: MaintenanceRecord, closing: RecordClosing): string | null {
  if (closing.status === "fixed" && record.kind !== "issues") {
    return "only a known issue (KI) is fixed; use resolved.";
  }

  if (closing.status !== "duplicate") {
    return closing.duplicateOf ? "duplicateOf goes with status duplicate only." : null;
  }

  return duplicateProblem(index, record, closing.duplicateOf);
}

function duplicateProblem(index: VaultIndex, record: MaintenanceRecord, original: RecordRef | null): string | null {
  if (!original) {
    return "a duplicate needs duplicateOf: the register path and id of the record it repeats.";
  }

  if (original.path === record.path && original.id === record.id) {
    return "a record can't duplicate itself.";
  }

  const exists = maintenanceRecords(original.path, index.note(original.path)?.content ?? "").some((candidate) => candidate.id === original.id);

  return exists ? null : `no record ${original.id} in ${original.path}; read_note shows the register.`;
}

// Vault content only (user decision 2026-10-06): each quote must stand in the named note of the same vault.
function evidenceProblem(index: VaultIndex, evidence: RecordEvidence[]): string | null {
  const missing = evidence.filter((item) => !hasQuote(index, item)).map((item) => `"${item.quote.slice(0, 80)}" in ${item.path}`);

  return missing.length > 0 ? `evidence not found; quote a note of this vault word for word: ${missing.join("; ")}` : null;
}

function hasQuote(index: VaultIndex, evidence: RecordEvidence): boolean {
  const content = index.note(evidence.path)?.content;

  return content !== undefined && normalized(content).includes(normalized(evidence.quote));
}

// Line breaks and repeated spaces in a quote don't count; case doesn't either.
function normalized(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}

function isSameRecord(a: RecordDecision, b: RecordDecision): boolean {
  return a.vault === b.vault && a.path === b.path && a.recordId === b.recordId;
}

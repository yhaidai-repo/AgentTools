import { localItem, vaultReviewDecision, type PowerLoomDb } from "@powerloom/db";
import { isLinkEditable, isProtectedNote, maintenanceRecords, type MaintenanceRecord, type ScannedNote, type VaultIndex } from "@powerloom/vault";
import { and, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { VaultReviewCandidates } from "./models/VaultReviewCandidates";
import type { VaultReviewOptions } from "./models/VaultReviewOptions";

const DAY_MS = 24 * 60 * 60 * 1000;
const WAITING_TASK = ["open", "in-progress", "blocked"] as const;

export const VAULT_REVIEW_AGENT = "vault-review";

const DEFAULT_STALE_DAYS = 60;

// From the agent's Config options, so the worker's count and the agent's lists use the same values.
export function vaultReviewOptions(agentOptions: Record<string, unknown>, now = new Date()): VaultReviewOptions {
  return { staleDays: numberOr(agentOptions.staleDays, DEFAULT_STALE_DAYS), now };
}

// The candidates the agent's list tools return and its first message counts (user decision
// 2026-10-03: stale = no inbound link or no use for staleDays; a note's age doesn't matter, 2026-10-06). Protected notes
// and notes decided recently are left out; dead links are listed only where the agent may fix them. Open register
// records are checked too (user decision 2026-10-06), unless one was kept recently.
export async function reviewCandidates(db: PowerLoomDb, index: VaultIndex, options: VaultReviewOptions): Promise<VaultReviewCandidates> {
  const settled = await settledNotes(db, index.vault, options);
  const settledRecord = await settledRecords(db, index.vault, options);
  const reviewable = index.notes.filter((note) => !isProtectedNote(note.path) && !settled(note));

  return {
    stale: reviewable.filter((note) => isUnused(index, note, options)),
    unlinked: reviewable.filter((note) => index.linksTo(note.path).length === 0),
    deadLinks: index.deadLinks().filter((link) => isLinkEditable(link.from)),
    records: openRecords(index).filter((record) => !settledRecord(record)),
  };
}

export function candidateCount(candidates: VaultReviewCandidates): number {
  const notes = new Set([...candidates.stale, ...candidates.unlinked].map((note) => note.path));

  return notes.size + candidates.deadLinks.length + candidates.records.length;
}

function openRecords(index: VaultIndex): MaintenanceRecord[] {
  return index.notes.flatMap((note) => maintenanceRecords(note.path, note.content)).filter((record) => record.isOpen);
}

// "Never used" means something only once the log is older than staleDays (logs began 2026-09-30).
function isUnused(index: VaultIndex, note: ScannedNote, options: VaultReviewOptions): boolean {
  const cutoff = daysBefore(options.now, options.staleDays);
  const logStart = index.logStartedAt();

  if (!logStart || logStart > cutoff) {
    return false;
  }

  const lastUse = index.lastUse(note.path);

  return !lastUse || lastUse < cutoff;
}

// A note is settled while the tech-writer task its `actualize` created waits, and for staleDays after any decision
// unless it changed since.
async function settledNotes(db: PowerLoomDb, vault: string, options: VaultReviewOptions): Promise<(note: ScannedNote) => boolean> {
  const recheckFrom = daysBefore(options.now, options.staleDays);
  const rows = await db
    .select({ path: vaultReviewDecision.path, noteMtime: vaultReviewDecision.noteMtime, decidedAt: vaultReviewDecision.decidedAt, taskStatus: localItem.status })
    .from(vaultReviewDecision)
    .leftJoin(localItem, eq(localItem.id, vaultReviewDecision.taskId))
    .where(and(eq(vaultReviewDecision.vault, vault), isNull(vaultReviewDecision.recordId), or(gte(vaultReviewDecision.decidedAt, recheckFrom), inArray(localItem.status, [...WAITING_TASK]))));

  return (note) => rows.some((row) => row.path === note.path && (isWaiting(row.taskStatus) || (row.decidedAt >= recheckFrom && note.mtime <= row.noteMtime)));
}

// A record kept within staleDays stays settled until its own `Updated` date moves past the decision's day (the
// register's mtime changes with every other record, so it can't tell).
async function settledRecords(db: PowerLoomDb, vault: string, options: VaultReviewOptions): Promise<(record: MaintenanceRecord) => boolean> {
  const recheckFrom = daysBefore(options.now, options.staleDays);
  const rows = await db
    .select({ path: vaultReviewDecision.path, recordId: vaultReviewDecision.recordId, decidedAt: vaultReviewDecision.decidedAt })
    .from(vaultReviewDecision)
    .where(and(eq(vaultReviewDecision.vault, vault), isNotNull(vaultReviewDecision.recordId), gte(vaultReviewDecision.decidedAt, recheckFrom)));

  return (record) => rows.some((row) => row.path === record.path && row.recordId === record.id && (record.updated ?? "") <= isoDay(row.decidedAt));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWaiting(status: string | null): boolean {
  return status !== null && (WAITING_TASK as readonly string[]).includes(status);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

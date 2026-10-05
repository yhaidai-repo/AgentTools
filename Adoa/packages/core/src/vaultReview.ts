import { localItem, vaultReviewDecision, type AdoaDb } from "@adoa/db";
import { isLinkEditable, isProtectedNote, type ScannedNote, type VaultIndex } from "@adoa/vault";
import { and, eq, gte, inArray, or } from "drizzle-orm";
import type { VaultReviewCandidates } from "./models/VaultReviewCandidates";
import type { VaultReviewOptions } from "./models/VaultReviewOptions";

const DAY_MS = 24 * 60 * 60 * 1000;
const WAITING_TASK = ["open", "in-progress", "blocked"] as const;

export const VAULT_REVIEW_AGENT = "vault-review";

const DEFAULT_STALE_DAYS = 60;
const DEFAULT_RECHECK_DAYS = 90;

// From the agent's Config options, so the worker's count and the agent's lists use the same values.
export function vaultReviewOptions(agentOptions: Record<string, unknown>, now = new Date()): VaultReviewOptions {
  return {
    staleDays: numberOr(agentOptions.staleDays, DEFAULT_STALE_DAYS),
    recheckDays: numberOr(agentOptions.recheckDays, DEFAULT_RECHECK_DAYS),
    now,
  };
}

// The candidates the worker counts before it creates a review task and the agent's list tools return (user decision
// 2026-10-03: stale = no inbound link or no use for staleDays). Protected notes, notes changed within staleDays and
// notes decided recently are left out; dead links are listed only where the agent may fix them.
export async function reviewCandidates(db: AdoaDb, index: VaultIndex, options: VaultReviewOptions): Promise<VaultReviewCandidates> {
  const settled = await settledNotes(db, index.vault, options);
  const reviewable = index.notes.filter((note) => !isProtectedNote(note.path) && !settled(note) && !isRecentlyChanged(note, options));

  return {
    stale: reviewable.filter((note) => isUnused(index, note, options)),
    unlinked: reviewable.filter((note) => index.linksTo(note.path).length === 0),
    deadLinks: index.deadLinks().filter((link) => isLinkEditable(link.from)),
  };
}

export function candidateCount(candidates: VaultReviewCandidates): number {
  const notes = new Set([...candidates.stale, ...candidates.unlinked].map((note) => note.path));

  return notes.size + candidates.deadLinks.length;
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

// A new or just changed note gets staleDays before it is offered (assumption: measured by file mtime).
function isRecentlyChanged(note: ScannedNote, options: VaultReviewOptions): boolean {
  return note.mtime > daysBefore(options.now, options.staleDays);
}

// A note is settled while the tech-writer task its `actualize` created waits, and for recheckDays after any decision
// unless it changed since.
async function settledNotes(db: AdoaDb, vault: string, options: VaultReviewOptions): Promise<(note: ScannedNote) => boolean> {
  const recheckFrom = daysBefore(options.now, options.recheckDays);
  const rows = await db
    .select({ path: vaultReviewDecision.path, noteMtime: vaultReviewDecision.noteMtime, decidedAt: vaultReviewDecision.decidedAt, taskStatus: localItem.status })
    .from(vaultReviewDecision)
    .leftJoin(localItem, eq(localItem.id, vaultReviewDecision.taskId))
    .where(and(eq(vaultReviewDecision.vault, vault), or(gte(vaultReviewDecision.decidedAt, recheckFrom), inArray(localItem.status, [...WAITING_TASK]))));

  return (note) => rows.some((row) => row.path === note.path && (isWaiting(row.taskStatus) || (row.decidedAt >= recheckFrom && note.mtime <= row.noteMtime)));
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

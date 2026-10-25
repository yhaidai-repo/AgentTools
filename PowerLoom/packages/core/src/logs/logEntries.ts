import { logEntry, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import type { LogEntryQuery } from "../models/LogEntryQuery";
import type { LogEntryRow } from "../models/LogEntryRow";
import type { NewLogEntry } from "../models/NewLogEntry";
import { logFingerprint, logMessage } from "./logFingerprint";

/** Records a warning or error; a repeat adds to its row's count and keeps the latest text and ids. */
export async function recordLogEntry(db: PowerLoomDb, entry: NewLogEntry): Promise<void> {
  const ids = { runId: entry.runId ?? null, taskId: entry.taskId ?? null, pbiId: entry.pbiId ?? null, vault: entry.vault ?? null };
  const message = logMessage(entry.message);

  await db
    .insert(logEntry)
    .values({ service: entry.service, level: entry.level, message, fingerprint: logFingerprint(entry), ...ids })
    .onConflictDoUpdate({ target: logEntry.fingerprint, set: { count: sql`${logEntry.count} + 1`, lastAt: new Date(), message, ...ids } });
}

export function readLogEntries(db: PowerLoomDb, query: LogEntryQuery): Promise<LogEntryRow[]> {
  return db.select().from(logEntry).where(and(...conditionsOf(query))).orderBy(desc(logEntry.lastAt)).limit(query.limit);
}

const ABOUT_LIMIT = 20;

/** What was logged about a task, or a run of it, since a time: for task_get and run_get. */
export function readLogEntriesAbout(db: PowerLoomDb, about: { taskId: string | null; runId?: number | null }, since: Date): Promise<LogEntryRow[]> {
  const subjects = [about.taskId ? eq(logEntry.taskId, about.taskId) : null, about.runId ? eq(logEntry.runId, about.runId) : null].filter((condition): condition is SQL => condition !== null);

  if (subjects.length === 0) {
    return Promise.resolve([]);
  }

  return db.select().from(logEntry).where(and(gte(logEntry.lastAt, since), or(...subjects))).orderBy(desc(logEntry.lastAt)).limit(ABOUT_LIMIT);
}

function conditionsOf(query: LogEntryQuery): SQL[] {
  const optional: (SQL | null)[] = [
    query.service ? eq(logEntry.service, query.service) : null,
    query.level ? eq(logEntry.level, query.level) : null,
    query.runId ? eq(logEntry.runId, query.runId) : null,
    query.taskId ? eq(logEntry.taskId, query.taskId) : null,
    query.search ? ilike(logEntry.message, `%${query.search}%`) : null,
  ];

  return [gte(logEntry.lastAt, query.since), ...optional.filter((condition): condition is SQL => condition !== null)];
}

import { vaultNoteWrite, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import type { PowerLoomNote } from "../models/PowerLoomNote";

type WriteRow = typeof vaultNoteWrite.$inferSelect;

// Created or updated, per note (user decision 2026-10-02): the note's own stamp only keeps PowerLoom's latest change, so the
// tech-writer records each write.
export async function withWriteActions(db: PowerLoomDb, vault: string, notes: PowerLoomNote[]): Promise<PowerLoomNote[]> {
  const paths = notes.map((note) => note.path);
  const writes = paths.length > 0 ? await db.select().from(vaultNoteWrite).where(and(eq(vaultNoteWrite.vault, vault), inArray(vaultNoteWrite.path, paths))) : [];

  return notes.map((note) => withAction(note, writes.filter((write) => write.path === note.path)));
}

function withAction(note: PowerLoomNote, writes: WriteRow[]): PowerLoomNote {
  const latest = writes.find((write) => write.runId === note.runId) ?? null;
  const created = writes.find((write) => write.action === "created") ?? null;

  return { ...note, action: latest?.action ?? null, createdByRunId: created?.runId ?? null };
}

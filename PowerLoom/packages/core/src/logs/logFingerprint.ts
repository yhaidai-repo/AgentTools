import { createHash } from "node:crypto";
import type { NewLogEntry } from "../models/NewLogEntry";

export const MAX_LOG_MESSAGE = 2000;

/** A message as stored: cut to MAX_LOG_MESSAGE characters, so one huge stack trace can't bloat the table. */
export function logMessage(message: string): string {
  return message.length > MAX_LOG_MESSAGE ? `${message.slice(0, MAX_LOG_MESSAGE - 1)}…` : message;
}

/** What merges repeats into one row: the service, level, task and the message with its numbers left out (a retry in 30 s
 *  and one in 60 s, RUN-5 and RUN-6 failing alike, are the same problem). The backend computes it the same way. */
export function logFingerprint(entry: NewLogEntry): string {
  const message = logMessage(entry.message).replace(/\d+/g, "#");

  return createHash("sha1").update([entry.service, entry.level, entry.taskId ?? "", message].join("|")).digest("hex");
}

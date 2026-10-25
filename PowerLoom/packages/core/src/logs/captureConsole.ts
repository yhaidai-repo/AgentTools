import { format } from "node:util";
import type { PowerLoomDb } from "@powerloom/db";
import { recordLogEntry } from "./logEntries";

/** Every console.warn and console.error of this process also goes to the error log. Best effort: a failed write is
 *  dropped without logging anything itself, so it can't loop. */
export function captureConsoleErrors(db: PowerLoomDb, service: string): void {
  console.warn = captured(console.warn.bind(console), db, service, "warn");
  console.error = captured(console.error.bind(console), db, service, "error");
}

function captured(original: (...args: unknown[]) => void, db: PowerLoomDb, service: string, level: "warn" | "error"): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    original(...args);
    void recordLogEntry(db, { service, level, message: format(...args) }).catch(() => undefined);
  };
}

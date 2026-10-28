import type { RecordWorkContext, RecordWorkReference } from "../models/RecordWorkContext";
import { maintenanceRecords } from "./maintenanceRecords";

const ORIGIN_LINE = /^- (Created|Updated) in: ([^\r\n]*)\r?$/gm;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$(?!\n)/;

export function recordWorkLine(action: RecordWorkReference["action"], context: RecordWorkContext, date?: string): string | null {
  const parts = [
    ...(Number.isSafeInteger(context.pbiId) && context.pbiId! > 0 ? [`pbi:${context.pbiId}`] : []),
    ...(context.taskId && SAFE_ID.test(context.taskId) ? [`task:${context.taskId}`] : []),
    ...(context.chatId && SAFE_ID.test(context.chatId) ? [`chat:${context.chatId}`] : context.sessionId && SAFE_ID.test(context.sessionId) ? [`session:${context.sessionId}`] : []),
  ];

  return parts.length ? `- ${action === "created" ? "Created" : "Updated"} in: ${date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date} · ` : ""}${parts.join(" · ")}` : null;
}

export function parseRecordWorkReferences(text: string): RecordWorkReference[] {
  return [...text.matchAll(ORIGIN_LINE)].flatMap((match) => {
    const context: RecordWorkReference = { action: match[1] === "Created" ? "created" : "updated" };
    for (const part of match[2].split(" · ")) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) context.date = part;
      else if (/^pbi:[1-9]\d*$/.test(part) && Number.isSafeInteger(Number(part.slice(4)))) context.pbiId = Number(part.slice(4));
      else for (const [prefix, key] of [["task:", "taskId"], ["chat:", "chatId"], ["session:", "sessionId"]] as const) {
        if (part.startsWith(prefix) && SAFE_ID.test(part.slice(prefix.length))) context[key] = part.slice(prefix.length);
      }
    }
    return context.pbiId || context.taskId || context.chatId || context.sessionId ? [context] : [];
  });
}

// Apply at the actual write, including raw tech-writer edits. Existing provenance survives a rewritten record;
// retries and changes only to provenance don't create another update. Legacy creation context stays unknown.
export function withRecordWorkReferences(path: string, previous: string, next: string, context: RecordWorkContext, date: string): string {
  const before = new Map(maintenanceRecords(path, previous).map((record) => [record.id, record]));
  let result = next;
  for (const record of maintenanceRecords(path, next)) {
    const old = before.get(record.id);
    const history = old ? [...old.text.matchAll(ORIGIN_LINE)].map((match) => match[0].trimEnd()) : [];
    const changed = !old || withoutOrigins(old.text) !== withoutOrigins(record.text);
    const line = changed ? recordWorkLine(old ? "updated" : "created", context, date) : null;
    const missing = [...history, ...(line ? [line] : [])].filter((entry, index, entries) => entries.indexOf(entry) === index && !record.text.split(/\r?\n/).includes(entry));
    if (missing.length) {
      const eol = next.includes("\r\n") ? "\r\n" : "\n";
      result = result.replace(record.text, () => `${record.text.trimEnd()}${eol}${missing.join(eol)}`);
    }
  }
  return result;
}

function withoutOrigins(text: string): string {
  return text.replace(ORIGIN_LINE, "").trim().replaceAll(/\r\n/g, "\n");
}

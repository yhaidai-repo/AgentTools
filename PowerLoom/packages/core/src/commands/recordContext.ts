import { z } from "zod";
import type { RecordWorkContext } from "@powerloom/vault";
import type { CommandContext } from "../models/CommandContext";

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$(?!\n)/, "an id without whitespace or Markdown");
export const recordContextInput = z.object({
  pbiId: z.number().int().positive().optional(),
  taskId: id.optional(),
  chatId: id.optional().describe("The actual Codex/Claude chat id, when known; never guess it"),
  sessionId: id.optional().describe("The MCP session id; captured automatically for MCP callers"),
}).optional().describe("The PBI, task or chat where this record is created or updated; omit unknown ids");

export function recordContextFields(context: CommandContext, supplied?: RecordWorkContext): { context?: RecordWorkContext } {
  const merged = { ...supplied, ...context.recordContext };
  return Object.keys(merged).length ? { context: merged } : {};
}

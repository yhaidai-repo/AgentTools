import type { DataAccessOutcome } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import type { z } from "zod";
import type { DataAccessLog } from "./DataAccessLog";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";
import type { OutsideToolResult } from "./models/OutsideToolResult";

// A thrown error's text in the log, cut short.
const MAX_ERROR_CHARS = 300;

// The tools that log themselves here; the run's ToolCallLogger skips them so no call is logged twice.
const OUTSIDE_TOOLS = new Set<string>();

export function isOutsideTool(name: string): boolean {
  return OUTSIDE_TOOLS.has(name);
}

export interface OutsideTool<TInput extends z.ZodRawShape> {
  name: string;
  description: string;
  input: TInput;
  /** Where this call reads, from its input (the connection or resource the agent chose). */
  resource: (input: z.infer<z.ZodObject<TInput>>) => OutsideResource;
  /** The request as sent, from its input: the query, the filter, the queue, the link. */
  request: (input: z.infer<z.ZodObject<TInput>>) => string;
  handler: (input: z.infer<z.ZodObject<TInput>>) => Promise<OutsideToolResult>;
}

// The one wrapper around every tool that reads an outside system (user decision 2026-10-13): every call becomes a
// data access log row with its outcome; the tool code only names the resource and the request. The access-request
// side (a human task for a denied call) builds on the same place.
export function defineOutsideTool<TInput extends z.ZodRawShape>(log: DataAccessLog, context: OutsideAccessContext, tool: OutsideTool<TInput>): ToolDefinition<any> {
  OUTSIDE_TOOLS.add(tool.name);

  return defineTool({
    name: tool.name,
    description: tool.description,
    input: tool.input,
    handler: async (input) => {
      const startedAt = new Date();
      const result = await settle(tool.handler(input));

      await log.record({
        ...context,
        ...tool.resource(input),
        tool: tool.name,
        request: tool.request(input),
        ...outcomeOf(result),
        rows: result.rows ?? null,
        bytes: Buffer.byteLength(result.text, "utf8"),
        truncated: result.truncated ?? false,
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
      });

      return { text: result.text, isError: result.isError };
    },
  });
}

// A tool that throws is a failed call, logged like any other; the agent gets the error text.
async function settle(call: Promise<OutsideToolResult>): Promise<OutsideToolResult> {
  try {
    return await call;
  } catch (error) {
    return { text: `The tool failed: ${(error as Error).message}`, isError: true };
  }
}

export function outcomeOf(result: OutsideToolResult): { outcome: DataAccessOutcome; reason: string | null } {
  if (result.refusal) {
    return { outcome: "refused", reason: result.refusal };
  }

  if (result.denied) {
    return { outcome: "denied", reason: result.text.slice(0, MAX_ERROR_CHARS) };
  }

  return result.isError ? { outcome: "failed", reason: result.text.slice(0, MAX_ERROR_CHARS) } : { outcome: "ok", reason: null };
}

import type { DataAccessOutcome } from "@powerloom/db";
import { defineTool, type ToolAnnotations, type ToolCallContext, type ToolDefinition } from "@agenttools/runtime";
import type { z } from "zod";
import type { OutsideAccessServices } from "./models/OutsideAccessServices";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideCall } from "./models/OutsideCall";
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
  handler: (input: z.infer<z.ZodObject<TInput>>, call?: ToolCallContext) => Promise<OutsideToolResult>;
  /** What the call does to the outside system or to PowerLoom; MCP clients show and gate calls by it. */
  annotations?: ToolAnnotations;
}

// The one wrapper around every tool that reads an outside system (user decision 2026-10-13): every call becomes a
// data access log row with its outcome, and a denied call becomes a human task with the fix plus the agent task's
// re-run anchor; the tool code only names the resource and the request.
export function defineOutsideTool<TInput extends z.ZodRawShape>(services: OutsideAccessServices, context: OutsideAccessContext, tool: OutsideTool<TInput>): ToolDefinition<any> {
  OUTSIDE_TOOLS.add(tool.name);

  return defineTool({
    name: tool.name,
    description: tool.description,
    input: tool.input,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
    handler: async (input, call) => {
      const startedAt = new Date();
      const resource = tool.resource(input);
      const result = await settle(tool.handler(input, call));

      await recordOutsideCall(services, context, { tool: tool.name, resource, request: tool.request(input), result, startedAt });

      if (outcomeOf(result).outcome !== "denied") {
        return { text: result.text, isError: result.isError, ...(result.images ? { images: result.images } : {}) };
      }

      return { text: await withAccessRequest(services, context, resource, tool.name, result.text), isError: true };
    },
  });
}

/** Writes one call's data access log row; for steps that reach an outside system without being a tool of their own. */
export async function recordOutsideCall(services: OutsideAccessServices, context: OutsideAccessContext, call: OutsideCall): Promise<void> {
  const { result, startedAt } = call;

  await services.log.record({
    ...context,
    ...call.resource,
    tool: call.tool,
    request: call.request,
    ...outcomeOf(result),
    rows: result.rows ?? null,
    bytes: Buffer.byteLength(result.text, "utf8"),
    truncated: result.truncated ?? false,
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
  });
}

// The agent learns which task asks for the fix and that its own task runs again afterwards, so it goes on without
// retrying. A request that can't be written (the database is down) doesn't hide the refusal.
async function withAccessRequest(services: OutsideAccessServices, context: OutsideAccessContext, resource: OutsideResource, tool: string, text: string): Promise<string> {
  try {
    const request = await services.requests.request(context, resource, tool, text);

    return `${text}\n\nAccess to ${resource.resource} was refused. Task ${request.id} asks a person to fix it, and your task runs again once it's closed: go on with what you have and name the gap in your output.`;
  } catch (error) {
    console.error(`access request for ${resource.resource} (run ${context.runId}) not written:`, error);

    return `${text}\n\nAccess to ${resource.resource} was refused and no task could be created for it: go on with what you have and name the gap in your output.`;
  }
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

  return result.isError ? { outcome: "failed", reason: result.text.slice(0, MAX_ERROR_CHARS) } : { outcome: "ok", reason: result.note?.slice(0, MAX_ERROR_CHARS) ?? null };
}

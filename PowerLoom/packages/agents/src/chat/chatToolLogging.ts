import type { ToolDefinition, ToolResult } from "@agenttools/runtime";
import type { DataAccessLog } from "../DataAccessLog";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import { isOutsideTool } from "../outsideAccess";
import { classifyToolCall } from "../toolKinds";

// A failed result's text in the log, cut short (as ToolCallLogger keeps it).
const MAX_REASON_CHARS = 300;

// A chat has no run events to log from (ToolCallLogger reads an agent run's), so each of its tools logs around its own
// handler; the outside-read tools log themselves and are left alone, so no call is logged twice.
export function withChatLogging(tools: ToolDefinition<any>[], log: DataAccessLog, context: OutsideAccessContext): ToolDefinition<any>[] {
  return tools.map((tool) => (isOutsideTool(tool.name) ? tool : logged(tool, log, context)));
}

function logged(tool: ToolDefinition<any>, log: DataAccessLog, context: OutsideAccessContext): ToolDefinition<any> {
  return {
    ...tool,
    handler: async (input) => {
      const startedAt = new Date();
      const result = await settle(tool.handler(input));

      await log.record({
        ...context,
        ...classifyToolCall(tool.name, input),
        tool: tool.name,
        outcome: result.isError ? "failed" : "ok",
        reason: result.isError ? result.text.slice(0, MAX_REASON_CHARS) : null,
        rows: null,
        bytes: Buffer.byteLength(result.text, "utf8"),
        truncated: false,
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
      });

      return result;
    },
  };
}

// A tool that throws is logged as failed and answers the error, as the runtime adapters do.
async function settle(call: Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await call;
  } catch (error) {
    return { text: `Error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

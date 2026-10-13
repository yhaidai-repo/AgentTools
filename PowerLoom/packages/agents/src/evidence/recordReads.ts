import type { ToolDefinition, ToolResult } from "@agenttools/runtime";
import type { ReadLog } from "./ReadLog";

// Wraps reading tools so each successful result is logged and ends with its source id. Pass reading tools only: a
// writing tool's own input in the log would let its evidence cite itself.
export function recordReads(tools: ToolDefinition<any>[], log: ReadLog): ToolDefinition<any>[] {
  return tools.map((tool) => ({ ...tool, handler: async (input: Record<string, unknown>) => withSource(await tool.handler(input), input, log) }));
}

function withSource(result: ToolResult, input: Record<string, unknown>, log: ReadLog): ToolResult {
  if (result.isError) {
    return result;
  }

  const id = log.add(`${JSON.stringify(input)}\n${result.text}`);

  return { ...result, text: `${result.text}\n\n[source ${id}]` };
}

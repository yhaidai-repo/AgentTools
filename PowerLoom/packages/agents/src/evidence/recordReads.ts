import type { ToolCallContext, ToolDefinition, ToolResult } from "@agenttools/runtime";
import type { ReadLog } from "./ReadLog";

const SOURCE_SUFFIX = /\n\n\[source (S\d+)\]$/;

// Wraps reading tools so each successful result is logged and ends with its source id. Pass reading tools only: a
// writing tool's own input in the log would let its evidence cite itself. A continued run restores the earlier reads
// under their ids, so evidence citing them still checks.
export function recordReads(tools: ToolDefinition<any>[], log: ReadLog): ToolDefinition<any>[] {
  return tools.map((tool) => ({
    ...tool,
    handler: async (input: Record<string, unknown>, call?: ToolCallContext) => withSource(await tool.handler(input, call), input, log, tool.name),
    restore: (input: unknown, output: string) => restoreSource(input, output, log, tool.name),
  }));
}

function withSource(result: ToolResult, input: Record<string, unknown>, log: ReadLog, tool: string): ToolResult {
  if (result.isError) {
    return result;
  }

  const id = log.add(sourceText(input, result.text), { tool, resultText: result.text, fresh: true });

  return { ...result, text: `${result.text}\n\n[source ${id}]` };
}

function restoreSource(input: unknown, output: string, log: ReadLog, tool: string): void {
  const match = SOURCE_SUFFIX.exec(output);

  if (match) {
    log.restore(match[1], sourceText(input, output.slice(0, match.index)), { tool, resultText: output.slice(0, match.index), fresh: false });
  }
}

function sourceText(input: unknown, text: string): string {
  return `${JSON.stringify(input)}\n${text}`;
}

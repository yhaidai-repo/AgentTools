import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { ToolDefinition } from "../../models/ToolDefinition";

export const TOOL_SERVER_NAME = "agent";
const TOOL_PREFIX = `mcp__${TOOL_SERVER_NAME}__`;

// Our tools run in-process as one MCP server; the model sees them as `mcp__agent__<name>`.
export function createToolServer(tools: ToolDefinition<any>[]): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({ name: TOOL_SERVER_NAME, version: "1.0.0", tools: tools.map(toSdkTool) });
}

export function sdkToolNames(tools: ToolDefinition<any>[]): string[] {
  return tools.map((definition) => `${TOOL_PREFIX}${definition.name}`);
}

export function toNeutralToolName(sdkName: string): string {
  return sdkName.startsWith(TOOL_PREFIX) ? sdkName.slice(TOOL_PREFIX.length) : sdkName;
}

function toSdkTool(definition: ToolDefinition<any>) {
  return tool(definition.name, definition.description, definition.input, async (input) => {
    try {
      const result = await definition.handler(input);

      return { content: [{ type: "text" as const, text: result.text }], isError: result.isError ?? false };
    } catch (error) {
      // A failing tool is reported to the model, not thrown: the run continues and the trace shows it.
      return { content: [{ type: "text" as const, text: `Error: ${errorText(error)}` }], isError: true };
    }
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

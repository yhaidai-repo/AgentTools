import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { ToolDefinition } from "../../models/ToolDefinition";
import type { ToolImage } from "../../models/ToolImage";

export const TOOL_SERVER_NAME = "agent";
const TOOL_PREFIX = `mcp__${TOOL_SERVER_NAME}__`;

// Our tools run in-process as one MCP server; the model sees them as `mcp__agent__<name>`.
export function createToolServer(tools: ToolDefinition<any>[]): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({ name: TOOL_SERVER_NAME, version: "1.0.0", tools: tools.map(toSdkTool) });
}

export function sdkToolNames(tools: ToolDefinition<any>[]): string[] {
  return tools.map((definition) => `${TOOL_PREFIX}${definition.name}`);
}

// Prompts name tools neutrally (`list_branches`), but this adapter can only call them with the server prefix. Without
// this line a run's first calls used the bare names and failed with "No such tool available" (run 2469, 2026-10-21).
export function withSdkToolNaming(systemPrompt: string, tools: ToolDefinition<any>[]): string {
  const example = tools[0]?.name;

  if (!example) {
    return systemPrompt;
  }

  return `${systemPrompt}\n\nTools named in this prompt without a prefix are called as \`${TOOL_PREFIX}<name>\`, e.g. \`${TOOL_PREFIX}${example}\`.`;
}

export function toNeutralToolName(sdkName: string): string {
  return sdkName.startsWith(TOOL_PREFIX) ? sdkName.slice(TOOL_PREFIX.length) : sdkName;
}

function toSdkTool(definition: ToolDefinition<any>) {
  return tool(definition.name, definition.description, definition.input, async (input) => {
    try {
      const result = await definition.handler(input);

      return { content: [{ type: "text" as const, text: result.text }, ...imageBlocks(result.images)], isError: result.isError ?? false };
    } catch (error) {
      // A failing tool is reported to the model, not thrown: the run continues and the trace shows it.
      return { content: [{ type: "text" as const, text: `Error: ${errorText(error)}` }], isError: true };
    }
  });
}

// Images go to the model in the MCP content format; the SDK's in-process server passes them through.
function imageBlocks(images: ToolImage[] | undefined) {
  return (images ?? []).map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType }));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

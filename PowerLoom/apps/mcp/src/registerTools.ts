import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDefinition, ToolImage } from "@agenttools/runtime";

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

// Our tool definitions on an MCP server: the same conversion the Claude adapter makes for a run's in-process server,
// plus the annotations a client gates on (decision MCPQ-004, 2026-10-23).
export function registerTools(server: McpServer, tools: ToolDefinition<any>[]): void {
  for (const tool of tools) {
    registerTool(server, tool);
  }
}

function registerTool(server: McpServer, tool: ToolDefinition<any>): void {
  const annotations = { readOnlyHint: tool.annotations?.readOnly ?? false, destructiveHint: tool.annotations?.destructive ?? false };

  server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input, annotations }, async (input: unknown) => {
    try {
      const result = await tool.handler(input as never);

      return { content: [text(result.text), ...imageBlocks(result.images)], isError: result.isError ?? false };
    } catch (error) {
      // A failing tool is reported to the chat, not thrown: the session goes on and the log shows it.
      return { content: [text(`Error: ${error instanceof Error ? error.message : String(error)}`)], isError: true };
    }
  });
}

function text(value: string): Content {
  return { type: "text", text: value };
}

function imageBlocks(images: ToolImage[] | undefined): Content[] {
  return (images ?? []).map((image) => ({ type: "image", data: image.data, mimeType: image.mimeType }));
}

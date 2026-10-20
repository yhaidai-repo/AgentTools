import type { ToolImage } from "@agenttools/runtime";

// What one Playwright MCP tool call answered: its text parts, its images (screenshots) and whether it failed.
export interface McpCallResult {
  text: string;
  images: ToolImage[];
  isError: boolean;
}

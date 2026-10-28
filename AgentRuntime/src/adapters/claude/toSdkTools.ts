import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { ToolDefinition } from "../../models/ToolDefinition";
import type { ToolImage } from "../../models/ToolImage";

export const TOOL_SERVER_NAME = "agent";
const TOOL_PREFIX = `mcp__${TOOL_SERVER_NAME}__`;

// The sub-agent tool: the model's tool_use blocks name it `Agent`, while the init message lists it as `Task` (CLI
// 2.1.286, spike 2026-10-28). Both mean the same tool.
const SUBAGENT_TOOL = "Agent";
const LEGACY_SUBAGENT_TOOL = "Task";

// Our tools run in-process as one MCP server; the model sees them as `mcp__agent__<name>`. Their results name tools
// the way the model can call them (sdkToolNamer).
export function createToolServer(tools: ToolDefinition<any>[]): McpSdkServerConfigWithInstance {
  const toSdkText = sdkToolNamer(tools);

  return createSdkMcpServer({ name: TOOL_SERVER_NAME, version: "1.0.0", tools: tools.map((definition) => toSdkTool(definition, toSdkText)) });
}

// Prompts, task messages and tool results name tools neutrally (`read_pbi`), but this adapter can only call them with
// the server prefix. The hint line (withSdkToolNaming) alone wasn't enough: run 2542 followed its first message's
// `read_pbi(...)` and its first calls failed with "No such tool available". So what the model reads names every tool
// whose name has an underscore by its prefixed name; a name without one could be a plain word and keeps the hint only.
export function sdkToolNamer(tools: ToolDefinition<any>[]): (text: string) => string {
  const pattern = neutralNamePattern(tools);

  return (text) => (pattern ? text.replace(pattern, (name) => `${TOOL_PREFIX}${name}`) : text);
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
  if (sdkName.startsWith(TOOL_PREFIX)) {
    return sdkName.slice(TOOL_PREFIX.length);
  }

  return sdkName === LEGACY_SUBAGENT_TOOL ? SUBAGENT_TOOL : sdkName;
}

// A whole neutral name only: not one that is already prefixed, nor part of a longer word (`read_pbis`).
function neutralNamePattern(tools: ToolDefinition<any>[]): RegExp | null {
  const names = tools.map((definition) => definition.name).filter((name) => name.includes("_"));

  if (names.length === 0) {
    return null;
  }

  return new RegExp(`(?<![\\w-])(?:${names.map(escapeRegExp).join("|")})(?![\\w-])`, "g");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSdkTool(definition: ToolDefinition<any>, toSdkText: (text: string) => string) {
  return tool(definition.name, definition.description, definition.input, async (input) => {
    try {
      const result = await definition.handler(input);

      return { content: [{ type: "text" as const, text: toSdkText(result.text) }, ...imageBlocks(result.images)], isError: result.isError ?? false };
    } catch (error) {
      // A failing tool is reported to the model, not thrown: the run continues and the trace shows it.
      return { content: [{ type: "text" as const, text: `Error: ${toSdkText(errorText(error))}` }], isError: true };
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

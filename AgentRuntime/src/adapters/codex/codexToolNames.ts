import type { ToolDefinition } from "../../models/ToolDefinition";

const PREFIX = "mcp__agent__";

export function neutralCodexToolName(name: string): string {
  return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : name;
}

export function codexToolNamer(tools: ToolDefinition<any>[]): (text: string) => string {
  const names = tools.map((tool) => tool.name).filter((name) => name.includes("_"));

  if (names.length === 0) {
    return (text) => text;
  }

  const pattern = new RegExp("(?<![\\w-])(?:" + names.map(escapePattern).join("|") + ")(?![\\w-])", "g");

  return (text) => text.replace(pattern, (name) => PREFIX + name);
}

export function codexInstructions(prompt: string, tools: ToolDefinition<any>[]): string {
  const naming = tools.map((tool) => tool.name + " = " + PREFIX + tool.name).join(", ");
  const rewritten = codexToolNamer(tools)(prompt);

  return naming ? rewritten + "\n\nCall tools using these MCP names: " + naming + "." : rewritten;
}

function escapePattern(text: string): string {
  return text.replace(/[.*+?^{}()|[\]\\$]/g, "\\$&");
}

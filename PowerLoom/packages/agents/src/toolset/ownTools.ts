import type { ToolDefinition } from "@agenttools/runtime";

// A runner's own tools next to the shared ones: an own tool with a shared tool's name gives way to it (design's user
// task tool is create_task; the shared create_task covers the user and the task types the Config allows).
export function ownTools(own: ToolDefinition<any>[], shared: ToolDefinition<any>[]): ToolDefinition<any>[] {
  const taken = new Set(shared.map((tool) => tool.name));

  return own.filter((tool) => !taken.has(tool.name));
}

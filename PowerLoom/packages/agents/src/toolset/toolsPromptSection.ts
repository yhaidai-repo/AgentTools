import type { ToolDefinition } from "@agenttools/runtime";

const SUMMARY_CHARS = 160;

// The system prompt's list of the run's tools (user decision 2026-10-14): the agent sees everything its Config gave it,
// so no prompt has to claim what it has or lacks.
export function toolsPromptSection(tools: ToolDefinition<any>[]): string {
  const lines = tools.map((tool) => `- ${tool.name}: ${summaryOf(tool.description)}`);

  return ["## Your tools", "Every tool of this run, as your Config gives them; nothing else exists. Use any of them when it helps.", ...lines].join("\n");
}

export function summaryOf(description: string): string {
  const sentence = description.split(/(?<=[.!?])\s/)[0]?.trim() ?? "";

  return sentence.length > SUMMARY_CHARS ? `${sentence.slice(0, SUMMARY_CHARS - 1)}…` : sentence;
}

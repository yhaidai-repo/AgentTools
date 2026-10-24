import type { ToolDefinition, ToolResult } from "@agenttools/runtime";

// Past this share the note asks for the result: the run stops at 100% and only a written result survives it.
const WRITE_NOW_SHARE = 0.8;

// Every tool result ends with what the run has spent of its budget. Agents use extra budget well only when they can
// see it (budget-aware tool use, BATS 2025); before, research runs ran out without a saved answer.
export function withBudgetNotes(tools: ToolDefinition<any>[], spentUsd: () => number, budgetUsd: number, resultTool: string): ToolDefinition<any>[] {
  if (budgetUsd <= 0) {
    return tools;
  }

  return tools.map((tool) => ({ ...tool, handler: async (input: Record<string, unknown>) => withNote(await tool.handler(input), spentUsd(), budgetUsd, resultTool) }));
}

export function budgetNote(spentUsd: number, budgetUsd: number, resultTool: string): string {
  const share = spentUsd / budgetUsd;
  const used = `[budget: $${spentUsd.toFixed(2)} of $${budgetUsd.toFixed(2)} used, ${Math.round(share * 100)}%]`;

  return share >= WRITE_NOW_SHARE ? `${used} Write your result now with ${resultTool} (status partial if you aren't done); the run stops at 100%.` : used;
}

function withNote(result: ToolResult, spentUsd: number, budgetUsd: number, resultTool: string): ToolResult {
  return { ...result, text: `${result.text}\n${budgetNote(spentUsd, budgetUsd, resultTool)}` };
}

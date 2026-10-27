import type { ToolDefinition, ToolResult } from "@agenttools/runtime";
import type { RunUse } from "./models/RunUse";

// Past this share of the turns or the budget the note asks for the result: the run stops at 100% and only a written
// result survives it whole.
const WRITE_NOW_SHARE = 0.8;

// Every tool result ends with what the run has used of its turns and budget. Agents use their limits well only when they
// can see them (budget-aware tool use, BATS 2025); before, runs ran out of turns without a saved answer.
export function withLimitNotes(tools: ToolDefinition<any>[], use: () => RunUse, resultTool: string): ToolDefinition<any>[] {
  return tools.map((tool) => ({ ...tool, handler: async (input: Record<string, unknown>) => withNote(await tool.handler(input), use(), resultTool) }));
}

export function limitNote(use: RunUse, resultTool: string): string {
  const turnShare = use.maxTurns > 0 ? use.turns / use.maxTurns : 0;
  const budgetShare = use.budgetUsd > 0 ? use.spentUsd / use.budgetUsd : 0;
  const budget = use.budgetUsd > 0 ? [`budget: $${use.spentUsd.toFixed(2)} of $${use.budgetUsd.toFixed(2)} used, ${Math.round(budgetShare * 100)}%`] : [];
  const note = `[${[`turns: about ${use.turns} of ${use.maxTurns}`, ...budget].join("; ")}]`;

  return Math.max(turnShare, budgetShare) >= WRITE_NOW_SHARE ? `${note} Write your result now with ${resultTool} (status partial if you aren't done); the run stops at its limit.` : note;
}

function withNote(result: ToolResult, use: RunUse, resultTool: string): ToolResult {
  return { ...result, text: `${result.text}\n${limitNote(use, resultTool)}` };
}

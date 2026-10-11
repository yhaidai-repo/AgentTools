import type { GoalParams } from "./models/GoalParams";

// Any agent can be scheduled with a goal on the vault's repositories (user decision 2026-10-06); agents with a task
// producer (the vault review) make their own tasks instead. PowerLoom checks and creates the tasks; the form reads the
// saved params here.
export function goalParams(params: Record<string, unknown>): GoalParams {
  return { goal: String(params.goal ?? "").trim(), repos: Array.isArray(params.repos) ? params.repos.map(String) : [] };
}

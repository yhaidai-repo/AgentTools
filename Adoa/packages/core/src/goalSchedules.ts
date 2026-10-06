import { localItem, type AdoaDb } from "@adoa/db";
import { nextGlobalItemId } from "./localItemIds";
import type { GoalParams } from "./models/GoalParams";
import type { GoalTaskData } from "./models/GoalTaskData";
import type { TaskSchedule } from "./models/TaskSchedule";
import { enabledRepos } from "./repos";

const GOAL_MAX = 4_000;

// Any agent can be scheduled with a goal on the vault's repositories (user decision 2026-10-06); agents with a task
// producer (the vault review) make their own tasks instead.
export function goalParams(params: Record<string, unknown>): GoalParams {
  return { goal: String(params.goal ?? "").trim(), repos: Array.isArray(params.repos) ? params.repos.map(String) : [] };
}

export async function goalParamsProblem(db: AdoaDb, vault: string, params: GoalParams): Promise<string | null> {
  if (!params.goal) {
    return "A scheduled task needs a goal.";
  }

  if (params.goal.length > GOAL_MAX) {
    return `The goal is too long (${params.goal.length} of ${GOAL_MAX} characters).`;
  }

  const offered = (await enabledRepos(db, vault)).map((row) => row.name);
  const unknown = params.repos.filter((name) => !offered.includes(name));

  return unknown.length > 0 ? `Not among the vault's enabled repositories: ${unknown.join(", ")}.` : null;
}

// The tick's task: the schedule's goal and repos, for the schedule's agent; its resolution is the agent's written result.
export async function insertGoalTask(db: AdoaDb, schedule: TaskSchedule): Promise<string> {
  const id = await nextGlobalItemId(db, "GT");
  const params = goalParams(schedule.params);
  const data: GoalTaskData = { ...params, scheduleId: schedule.id, key: `schedule:${schedule.id}:${new Date().toISOString()}` };

  await db.insert(localItem).values({
    id,
    kind: "goal",
    pbiId: null,
    vault: schedule.vault,
    title: schedule.name.slice(0, 120),
    status: "open",
    assignee: `agent:${schedule.agentId}`,
    body: params.goal,
    data,
  });

  return id;
}

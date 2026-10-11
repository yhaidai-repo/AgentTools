// A scheduled task of any agent (user decision 2026-10-06): a goal on the chosen repositories, without a PBI.
export interface GoalTaskData {
  goal: string;
  repos: string[];
  scheduleId: number;
  key: string;
}

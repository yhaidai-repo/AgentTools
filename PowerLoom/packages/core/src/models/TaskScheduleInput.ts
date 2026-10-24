// A schedule by task type: on its cron it creates the described task for any agent taking the type, once until done.
export interface TaskScheduleInput {
  /** Null for a new schedule. */
  id: number | null;
  name: string;
  vault: string;
  cron: string;
  enabled: boolean;
  taskType: string;
  description: string | null;
  acceptanceCriteria: string | null;
  pbi: string | null;
  repos: string[];
}

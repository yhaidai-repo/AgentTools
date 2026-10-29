// What the task form starts with (user decision 2026-10-14): a task type, what to do, when it is done, and what it
// works on (a PBI, or the repos of research without one). With a cron it is a schedule by task type; `scheduleId` is
// set when one is edited.
export interface TaskFormValues {
  guideInputs?: Record<string, string>;
  type: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  pbi: string;
  repos: string[];
  scheduleId: number | null;
  cron: string;
  enabled: boolean;
}

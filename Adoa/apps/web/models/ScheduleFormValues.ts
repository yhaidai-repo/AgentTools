// What the schedule form starts with: a saved schedule, or the defaults of a new one (id null).
export interface ScheduleFormValues {
  id: number | null;
  name: string;
  agentId: string;
  cron: string;
  enabled: boolean;
  params: Record<string, string[]>;
}

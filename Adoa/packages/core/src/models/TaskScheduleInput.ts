// A schedule as the Tasks page saves it; id null = a new one.
export interface TaskScheduleInput {
  id: number | null;
  name: string;
  agentId: string;
  vault: string;
  cron: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

// One of PowerLoom's schedules (the sync, the checks) and when it is next due (ISO string).
export interface ScheduleStatus {
  key: string;
  cron: string;
  message: string;
  nextDueAt: string | null;
}

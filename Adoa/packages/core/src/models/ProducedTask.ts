// The task a producer builds for one schedule tick; the schedule adds its id, key, kind and assignee.
export interface ProducedTask {
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** Why a scheduled tick creates no task (e.g. nothing to review); null = needed. "Create now" creates it anyway. */
  notNeeded: string | null;
}

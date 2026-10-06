// One pg-boss queue as the Settings page describes it.
export interface JobInfo {
  queue: string;
  worker: "worker" | "agent-runner";
  trigger: string;
  purpose: string;
}

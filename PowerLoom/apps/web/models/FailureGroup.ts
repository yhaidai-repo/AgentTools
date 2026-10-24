import type { FailedRun } from "./FailedRun";

// Failed runs with the same agent and error, told once (user decision 2026-10-18): how many times, and the latest run.
export interface FailureGroup {
  agentId: string;
  error: string;
  times: number;
  latest: FailedRun;
}

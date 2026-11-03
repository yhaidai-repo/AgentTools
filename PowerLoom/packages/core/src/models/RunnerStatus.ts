import type { StateLevel } from "./StateLevel";

// The agent-runner as PowerLoom sees it: reachable or not, the tasks it runs (`runningTask` the first of them) and
// how many it may run at once (RUNNER_MAX_PARALLEL_RUNS; null from a runner that doesn't say).
export interface RunnerStatus {
  state: StateLevel;
  reachable: boolean;
  runningTask: string | null;
  runningTasks: string[];
  maxParallelRuns: number | null;
  url: string;
  detail: string | null;
}

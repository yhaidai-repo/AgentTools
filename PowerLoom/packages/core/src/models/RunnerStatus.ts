import type { StateLevel } from "./StateLevel";

// The agent-runner as PowerLoom sees it: reachable or not, and the task it runs.
export interface RunnerStatus {
  state: StateLevel;
  reachable: boolean;
  runningTask: string | null;
  url: string;
  detail: string | null;
}

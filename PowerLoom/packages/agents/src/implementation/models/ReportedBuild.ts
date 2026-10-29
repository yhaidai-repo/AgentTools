import type { BuildCheckpoint } from "@powerloom/db";

// What only the agent knows of its build: no file holds the summary for the reviewer, the pull request's title, the
// verdict in a line and how it settled the checkpoints executors stopped at.
export interface ReportedBuild {
  summary: string;
  prTitle: string;
  verdict: string;
  checkpoints: BuildCheckpoint[];
}

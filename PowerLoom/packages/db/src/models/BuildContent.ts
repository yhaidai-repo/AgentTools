import type { BuildCheckpoint } from "./BuildCheckpoint";
import type { BuildCommands } from "./BuildCommands";
import type { BuildCommit } from "./BuildCommit";
import type { BuildDeviation } from "./BuildDeviation";
import type { BuildHandOver } from "./BuildHandOver";
import type { BuildPlan } from "./BuildPlan";
import type { OpenUatItem } from "./OpenUatItem";
import type { PhaseVerification } from "./PhaseVerification";

// A PBI's implementation as write_implementation read it from the worktree's .planning/ folder and git: where the branch
// is, how far each plan got, its commits, deviations and checkpoints, the verification matrix, the open UAT items and the
// hand-over. The agent adds only the summary, the checkpoints it settled and the verdict.
export interface BuildContent {
  summary: string;
  planVersion: number | null;
  repo: string;
  branch: string;
  baseBranch: string;
  worktree: string;
  headSha: string | null;
  commands: BuildCommands;
  plans: BuildPlan[];
  commits: BuildCommit[];
  deviations: BuildDeviation[];
  checkpoints: BuildCheckpoint[];
  verification: PhaseVerification[];
  uat: OpenUatItem[];
  handOver: BuildHandOver;
}

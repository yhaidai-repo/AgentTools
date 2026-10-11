import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { AgentDeps } from "../models/AgentDeps";

// Pull request worktrees live next to the cached repos, one folder per run; agents' code tools see only their run's folder.
const REVIEW_CHECKOUTS = ".reviews";

export function reviewCheckoutsRoot(deps: AgentDeps, runId: number): string {
  return join(deps.repoCacheRoot, REVIEW_CHECKOUTS, `run-${runId}`);
}

// At agent-runner start no run is active, so worktrees a crash left behind can go; git forgets them on its next prune.
export async function clearReviewCheckouts(repoCacheRoot: string): Promise<void> {
  await rm(join(repoCacheRoot, REVIEW_CHECKOUTS), { recursive: true, force: true });
}

import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { AgentDeps } from "../models/AgentDeps";

// Pull request worktrees live next to the cached repos, one folder per run; agents' code tools see only their run's folder.
const REVIEW_CHECKOUTS = ".reviews";

export function reviewCheckoutsRoot(deps: AgentDeps, runId: number): string {
  return join(deps.repoCacheRoot, REVIEW_CHECKOUTS, `run-${runId}`);
}

// At agent-runner start, worktrees a crash left behind can go; git forgets them on its next prune. A run the runner
// is running now (`liveRunIds`, empty at a cold start) keeps its folder.
export async function clearReviewCheckouts(repoCacheRoot: string, liveRunIds: ReadonlySet<number> = new Set()): Promise<void> {
  const root = join(repoCacheRoot, REVIEW_CHECKOUTS);

  if (liveRunIds.size === 0) {
    await rm(root, { recursive: true, force: true });

    return;
  }

  const live = new Set([...liveRunIds].map((runId) => `run-${runId}`));

  for (const entry of await readdir(root).catch(() => [] as string[])) {
    if (!live.has(entry)) {
      await rm(join(root, entry), { recursive: true, force: true });
    }
  }
}

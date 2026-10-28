import type { SandboxClient } from "@powerloom/sandbox";
import { RUN_OWNER_PREFIX, stackOwner } from "../devHubTools";

type RemoveCalls = Pick<SandboxClient, "removeOwned" | "removeByPrefix">;

// The end of a run: its sandbox goes with it. Returns what happened for the runner's log; never throws.
export async function removeRunSandbox(client: RemoveCalls, runId: number): Promise<string | null> {
  return noteOf(await client.removeOwned(stackOwner(runId)));
}

// The runner's start: no run is in progress, so a sandbox a run left behind (the runner stopped mid-run) is orphaned.
export async function removeOrphanedSandboxes(client: RemoveCalls): Promise<string | null> {
  return noteOf(await client.removeByPrefix(RUN_OWNER_PREFIX));
}

function noteOf(answer: Awaited<ReturnType<RemoveCalls["removeOwned"]>>): string | null {
  if (!answer.ok) {
    return `removing sandboxes failed: ${answer.message}`;
  }

  return answer.value.owners.length > 0 ? `removed the sandbox of ${answer.value.owners.join(", ")}` : null;
}

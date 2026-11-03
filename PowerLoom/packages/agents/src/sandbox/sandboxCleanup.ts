import type { SandboxClient } from "@powerloom/sandbox";
import { RUN_OWNER_PREFIX, stackOwner } from "../devHubTools";

type RemoveCalls = Pick<SandboxClient, "removeOwned" | "removeByPrefix">;
type SweepCalls = RemoveCalls & Pick<SandboxClient, "list">;

// The end of a run: its sandbox goes with it. Returns what happened for the runner's log; never throws.
export async function removeRunSandbox(client: RemoveCalls, runId: number): Promise<string | null> {
  return noteOf(await client.removeOwned(stackOwner(runId)));
}

// The runner's start: a sandbox a run left behind (the runner stopped mid-run) is orphaned, unless its run is one the
// runner is running now (`liveOwners`, empty at a cold start: then every run's sandbox goes in one call).
export async function removeOrphanedSandboxes(client: SweepCalls, liveOwners: ReadonlySet<string> = new Set()): Promise<string | null> {
  if (liveOwners.size === 0) {
    return noteOf(await client.removeByPrefix(RUN_OWNER_PREFIX));
  }

  const listed = await client.list(RUN_OWNER_PREFIX);

  if (!listed.ok) {
    return `removing sandboxes failed: ${listed.message}`;
  }

  const orphans = [...new Set(listed.value.map((sandbox) => sandbox.owner))].filter((owner) => !liveOwners.has(owner));
  const removed: string[] = [];

  for (const owner of orphans) {
    const answer = await client.removeOwned(owner);

    if (!answer.ok) {
      return `removing sandboxes failed: ${answer.message}`;
    }

    removed.push(...answer.value.owners);
  }

  return removed.length > 0 ? `removed the sandbox of ${removed.join(", ")}` : null;
}

function noteOf(answer: Awaited<ReturnType<RemoveCalls["removeOwned"]>>): string | null {
  if (!answer.ok) {
    return `removing sandboxes failed: ${answer.message}`;
  }

  return answer.value.owners.length > 0 ? `removed the sandbox of ${answer.value.owners.join(", ")}` : null;
}

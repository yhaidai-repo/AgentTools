import type { StackBridgeClient } from "@powerloom/localstack";
import { RUN_OWNER_PREFIX, stackOwner } from "./localStackTools";

type BridgeCalls = Pick<StackBridgeClient, "status" | "stop">;

// The end of a run (user decision 2026-10-13): the stack the run started stops with it. A stack someone else started
// (a person at the console, another run) is left alone. Returns what happened for the runner's log; never throws.
export async function stopRunStack(client: BridgeCalls, runId: number): Promise<string | null> {
  return stopStackOwnedBy(client, (owner) => owner === stackOwner(runId));
}

// The runner's start: no run is in progress, so a stack a run left behind (the runner stopped mid-run) is orphaned.
export async function stopOrphanedStack(client: BridgeCalls): Promise<string | null> {
  return stopStackOwnedBy(client, (owner) => owner.startsWith(RUN_OWNER_PREFIX));
}

async function stopStackOwnedBy(client: BridgeCalls, isOurs: (owner: string) => boolean): Promise<string | null> {
  const status = await client.status();

  if (!status.ok || status.value.phase === "idle" || status.value.owner === null || !isOurs(status.value.owner)) {
    return null;
  }

  const owner = status.value.owner;
  const stopped = await client.stop(owner);

  return stopped.ok ? `stopped the local stack of ${owner}` : `stopping the local stack of ${owner} failed: ${stopped.message}`;
}

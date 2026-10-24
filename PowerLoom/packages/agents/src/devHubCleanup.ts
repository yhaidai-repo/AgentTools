import type { DevHubClient } from "@powerloom/devhub";
import { CHAT_OWNER_PREFIX, RUN_OWNER_PREFIX, stackOwner } from "./devHubTools";

type DevHubCalls = Pick<DevHubClient, "status" | "stop">;
type BrowserCalls = Pick<DevHubClient, "browserStatus" | "closeBrowser">;

// The end of a run (user decision 2026-10-13): the stack the run started stops with it. A stack someone else started
// (a person at the console, another run) is left alone. Returns what happened for the runner's log; never throws.
export async function stopRunStack(client: DevHubCalls, runId: number): Promise<string | null> {
  return stopOwnedStack(client, stackOwner(runId));
}

// The end of a chat session (user decision 2026-10-24): the stack it started stops with it, by its owner name.
export async function stopOwnedStack(client: DevHubCalls, owner: string): Promise<string | null> {
  return stopStackOwnedBy(client, (candidate) => candidate === owner);
}

// The runner's start: no run is in progress, so a stack a run left behind (the runner stopped mid-run) is orphaned.
export async function stopOrphanedStack(client: DevHubCalls): Promise<string | null> {
  return stopStackOwnedBy(client, (owner) => owner.startsWith(RUN_OWNER_PREFIX));
}

// The MCP server's start: no chat session survives a restart, so a stack a session left behind is orphaned.
export async function stopOrphanedChatStack(client: DevHubCalls): Promise<string | null> {
  return stopStackOwnedBy(client, (owner) => owner.startsWith(CHAT_OWNER_PREFIX));
}

async function stopStackOwnedBy(client: DevHubCalls, isOurs: (owner: string) => boolean): Promise<string | null> {
  const status = await client.status();

  if (!status.ok || status.value.phase === "idle" || status.value.owner === null || !isOurs(status.value.owner)) {
    return null;
  }

  const owner = status.value.owner;
  const stopped = await client.stop(owner);

  return stopped.ok ? `stopped the local stack of ${owner}` : `stopping the local stack of ${owner} failed: ${stopped.message}`;
}

// The browser case a run opened closes with the run, so its recording is written; one opened by hand is left alone.
export async function closeRunBrowser(client: BrowserCalls, runId: number): Promise<string | null> {
  return closeOwnedBrowser(client, stackOwner(runId));
}

export async function closeOwnedBrowser(client: BrowserCalls, owner: string): Promise<string | null> {
  return closeBrowserOwnedBy(client, (candidate) => candidate === owner);
}

export async function closeOrphanedBrowser(client: BrowserCalls): Promise<string | null> {
  return closeBrowserOwnedBy(client, (owner) => owner.startsWith(RUN_OWNER_PREFIX));
}

export async function closeOrphanedChatBrowser(client: BrowserCalls): Promise<string | null> {
  return closeBrowserOwnedBy(client, (owner) => owner.startsWith(CHAT_OWNER_PREFIX));
}

async function closeBrowserOwnedBy(client: BrowserCalls, isOurs: (owner: string) => boolean): Promise<string | null> {
  const status = await client.browserStatus();

  if (!status.ok || !status.value.open || status.value.owner === null || !isOurs(status.value.owner)) {
    return null;
  }

  const owner = status.value.owner;
  const closed = await client.closeBrowser(owner);

  return closed.ok ? `closed the browser case of ${owner}` : `closing the browser case of ${owner} failed: ${closed.message}`;
}

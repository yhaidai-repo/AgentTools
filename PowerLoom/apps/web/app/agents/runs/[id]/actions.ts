"use server";

import type { StoredTraceEvent } from "@agenttools/usage";
import { loadRun } from "@powerloom/core";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { getUsageStore } from "@/lib/usage";

// A large trace loads session by session (the run page ships only its main session's events): one sub-session's
// events when it is opened or picked, or the whole trace for the flat view. A run of another vault has none, as its
// page is not found.
export async function loadRunEvents(runId: number, sessionId?: string): Promise<StoredTraceEvent[]> {
  const vault = await currentVault();
  const found = vault && Number.isInteger(runId) ? await loadRun(getDb(), runId, vault) : null;

  if (!found) {
    return [];
  }

  return getUsageStore().trace(String(runId), sessionId);
}

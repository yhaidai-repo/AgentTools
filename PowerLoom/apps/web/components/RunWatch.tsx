import { loadRunningRunIds } from "@/lib/runningRuns";
import { currentVault } from "@/lib/currentVault";
import { RunWatchClient } from "./RunWatchClient";

// On every page that shows the running strip (user request 2026-10-29): when an agent starts or finishes a run, the page
// updates itself once, so a task that waits for a run doesn't need a reload. The rest of the time it holds still.
export async function RunWatch() {
  const vault = await currentVault();

  return vault ? <RunWatchClient drawnWith={await loadRunningRunIds(vault)} /> : null;
}

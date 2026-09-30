import type { SyncWindow } from "./models/SyncWindow";

// Details are fetched for at most `cap` ids per run; the rest continue in the next run.
export function selectWindow(allIds: number[], cursor: number, cap: number): SyncWindow {
  const remaining = allIds.filter((id) => id > cursor);
  const ids = remaining.slice(0, cap);
  const isCycleComplete = remaining.length <= cap;

  return { ids, nextCursor: isCycleComplete ? 0 : ids[ids.length - 1] };
}

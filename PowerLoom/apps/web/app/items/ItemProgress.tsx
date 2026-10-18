import type { ItemDetail } from "@/lib/pbiDetail";
import { taskBucket, taskState } from "@/lib/taskLooks";

// A task's way in three stops (user request 2026-10-18): created, its current state (waits for you, held, open or
// running), and its end; the stop it is at rings, and rings amber while it waits for you.
export function ItemProgress({ item }: { item: ItemDetail["item"] }) {
  const bucket = taskBucket(item);
  const isClosed = bucket === "done" || bucket === "cancelled";
  const state = taskState(item);

  return (
    <div className="metro item-metro" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
      <span className="metro-track" style={{ left: "calc(100% / 6)", right: "calc(100% / 6)" }} />
      <span className="metro-done" style={{ left: "calc(100% / 6)", width: isClosed ? "calc(100% * 2 / 3)" : "calc(100% / 3)" }} />
      <Stop name="Created" state="passed" />
      <Stop name={isClosed ? "Worked on" : state.label} state={isClosed ? "passed" : "current"} paused={bucket === "you"} />
      <Stop name={isClosed ? state.label : "Done"} state={isClosed ? "current" : "ahead"} paused={false} />
    </div>
  );
}

function Stop({ name, state, paused = false }: { name: string; state: "passed" | "current" | "ahead"; paused?: boolean }) {
  return (
    <div className={`station ${state}${paused ? " paused" : ""}`}>
      <span className="station-dot" />
      <span className="station-name">{name}</span>
    </div>
  );
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StoredTraceEvent } from "./models/StoredTraceEvent";
import type { UsageStore } from "./models/UsageStore";
import { TraceRecorder } from "./TraceRecorder";

// Only appendTrace is used by the recorder.
function storeOf(appendTrace: (events: StoredTraceEvent[]) => Promise<void>): UsageStore {
  return { appendTrace } as unknown as UsageStore;
}

describe("TraceRecorder", () => {
  it("marks NUL characters and never cuts an emoji in half, as Postgres jsonb needs", async () => {
    const stored: StoredTraceEvent[] = [];
    const recorder = new TraceRecorder(storeOf(async (events) => { stored.push(...events); }), 3);

    await recorder.record({ runId: "1", seq: 1, at: new Date(), type: "tool_result", output: "a\u0000b", rows: ["xy😀"] });
    await recorder.flush();

    const payload = stored[0].payload as { output: string; rows: string[] };

    assert.equal(payload.output, "a␀b");
    assert.equal(payload.rows[0], "xy… [2 chars cut]");
    assert.doesNotMatch(JSON.stringify(stored[0].payload), /\\u0000|\\ud8/i);
  });

  it("drops and reports a batch the store rejects instead of failing the run", async () => {
    const dropped: number[] = [];
    const recorder = new TraceRecorder(storeOf(async () => { throw new Error("unsupported Unicode escape sequence"); }), 100, 50, (batch) => dropped.push(batch.length));

    await recorder.record({ runId: "1", seq: 1, at: new Date(), type: "usage" });
    await recorder.flush();

    assert.deepEqual(dropped, [1]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunHandoff } from "@powerloom/core";
import type { TaskContext } from "../models/TaskContext";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { DesignWriter } from "./DesignWriter";

// Every query chain resolves to no rows, so a run without a design writes nothing.
function emptyDb(): unknown {
  const chain: unknown = new Proxy(() => chain, {
    get: (_target, property) => (property === "then" ? (resolve: (rows: unknown[]) => void) => resolve([]) : chain),
    apply: () => chain,
  });

  return chain;
}

function target(handoffs: RunHandoff[]): WriterTarget {
  const deps = { db: emptyDb(), usageStore: { trace: async () => [] } };
  const task = { id: "DT-1-001", pbiId: 1, vault: "demo", data: {} };

  return { deps, task, runId: 7, agentId: "design", tasks: [], taskIds: handoffs.map((handoff) => handoff.toItemId), handoffs, result: null, stoppedEarly: false } as unknown as WriterTarget;
}

describe("DesignWriter.settlement", () => {
  it("leaves a run without a design to the questions it asked", async () => {
    const writer = new DesignWriter({} as TaskContext);

    await writer.commit(target([{ intent: "ask", toItemId: "Q-1-002" }]));

    assert.equal(writer.settlement(), null);
  });

  it("misses the design when the run only handed the work on", async () => {
    for (const intent of ["continue", "return"] as const) {
      const writer = new DesignWriter({} as TaskContext);

      await writer.commit(target([{ intent, toItemId: "XT-1-003" }]));

      assert.deepEqual(writer.settlement(), { kind: "missing", output: "a design (write_design) or the questions that stop it (hand_off to a person)" }, intent);
    }
  });
});

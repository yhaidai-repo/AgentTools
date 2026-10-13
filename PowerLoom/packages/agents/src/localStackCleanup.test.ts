import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StackPhase, StackStatus } from "@powerloom/localstack";
import { stopOrphanedStack, stopRunStack } from "./localStackCleanup";

function bridgeWith(phase: StackPhase, owner: string | null) {
  const stops: string[] = [];
  const status: StackStatus = { phase, running: phase === "ready", requestedServices: [], branch: null, startedAt: null, expiresAt: null, exitCode: null, owner, services: [], output: [] };

  const client = {
    status: async () => ({ ok: true as const, value: status }),
    stop: async (name: string) => {
      stops.push(name);

      return { ok: true as const, value: { output: [] } };
    },
  };

  return { client, stops };
}

describe("stopRunStack", () => {
  it("stops the stack the run started", async () => {
    const bridge = bridgeWith("ready", "powerloom-run-7");

    const note = await stopRunStack(bridge.client, 7);

    assert.deepEqual(bridge.stops, ["powerloom-run-7"]);
    assert.equal(note, "stopped the local stack of powerloom-run-7");
  });

  it("leaves another run's stack, a person's stack and an idle bridge alone", async () => {
    const otherRun = bridgeWith("ready", "powerloom-run-8");
    const person = bridgeWith("ready", null);
    const idle = bridgeWith("idle", null);

    await stopRunStack(otherRun.client, 7);
    await stopRunStack(person.client, 7);
    await stopRunStack(idle.client, 7);

    assert.deepEqual([...otherRun.stops, ...person.stops, ...idle.stops], []);
  });

  it("does nothing when the bridge doesn't answer", async () => {
    const client = { status: async () => ({ ok: false as const, message: "down", denied: false }), stop: async () => assert.fail("no stop without a status") };

    assert.equal(await stopRunStack(client, 7), null);
  });
});

describe("stopOrphanedStack", () => {
  it("stops any run's stack but not a person's", async () => {
    const run = bridgeWith("starting", "powerloom-run-3");
    const person = bridgeWith("ready", null);

    await stopOrphanedStack(run.client);
    await stopOrphanedStack(person.client);

    assert.deepEqual(run.stops, ["powerloom-run-3"]);
    assert.deepEqual(person.stops, []);
  });
});

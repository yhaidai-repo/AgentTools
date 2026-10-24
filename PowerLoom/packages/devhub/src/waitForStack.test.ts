import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DevHubAnswer } from "./models/DevHubAnswer";
import type { StackPhase } from "./models/StackPhase";
import type { StackStatus } from "./models/StackStatus";
import { waitForStack } from "./waitForStack";

function statusIn(phase: StackPhase): StackStatus {
  return { phase, running: phase === "ready", requestedServices: ["signals"], branch: null, startedAt: null, expiresAt: null, exitCode: null, owner: "run-1", services: [], output: [] };
}

// Answers the given phases in order, then the last one forever; the clock moves one poll per call.
function fakeDevHub(phases: (StackPhase | "error")[]) {
  let calls = 0;
  let clock = 0;

  const status = async (): Promise<DevHubAnswer<StackStatus>> => {
    const phase = phases[Math.min(calls, phases.length - 1)];
    calls++;

    if (phase === "error") {
      return { ok: false, message: "DevHub down", denied: false };
    }

    return { ok: true, value: statusIn(phase) };
  };

  const options = { timeoutMs: 30, pollMs: 10, sleep: async (ms: number) => { clock += ms; }, now: () => clock };

  return { status, options, calls: () => calls };
}

describe("waitForStack", () => {
  it("polls until the stack is ready", async () => {
    const devHub = fakeDevHub(["starting", "starting", "ready"]);

    const answer = await waitForStack(devHub.status, devHub.options);

    assert.ok(answer.ok);
    assert.equal(answer.value.status.phase, "ready");
    assert.equal(answer.value.timedOut, false);
    assert.equal(devHub.calls(), 3);
  });

  it("stops at a failed start", async () => {
    const devHub = fakeDevHub(["failed"]);

    const answer = await waitForStack(devHub.status, devHub.options);

    assert.ok(answer.ok);
    assert.equal(answer.value.status.phase, "failed");
  });

  it("reports a time-out with the last status when the stack keeps starting", async () => {
    const devHub = fakeDevHub(["starting"]);

    const answer = await waitForStack(devHub.status, devHub.options);

    assert.ok(answer.ok);
    assert.equal(answer.value.timedOut, true);
    assert.equal(devHub.calls(), 3);
  });

  it("passes DevHub's error through", async () => {
    const devHub = fakeDevHub(["starting", "error"]);

    const answer = await waitForStack(devHub.status, devHub.options);

    assert.equal(answer.ok, false);
  });
});

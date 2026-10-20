import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StackPhase, StackStatus } from "@powerloom/devhub";
import { closeOrphanedBrowser, closeRunBrowser, stopOrphanedStack, stopRunStack } from "./devHubCleanup";

function devHubWith(phase: StackPhase, owner: string | null) {
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
    const devHub = devHubWith("ready", "powerloom-run-7");

    const note = await stopRunStack(devHub.client, 7);

    assert.deepEqual(devHub.stops, ["powerloom-run-7"]);
    assert.equal(note, "stopped the local stack of powerloom-run-7");
  });

  it("leaves another run's stack, a person's stack and an idle DevHub alone", async () => {
    const otherRun = devHubWith("ready", "powerloom-run-8");
    const person = devHubWith("ready", null);
    const idle = devHubWith("idle", null);

    await stopRunStack(otherRun.client, 7);
    await stopRunStack(person.client, 7);
    await stopRunStack(idle.client, 7);

    assert.deepEqual([...otherRun.stops, ...person.stops, ...idle.stops], []);
  });

  it("does nothing when DevHub doesn't answer", async () => {
    const client = { status: async () => ({ ok: false as const, message: "down", denied: false }), stop: async () => assert.fail("no stop without a status") };

    assert.equal(await stopRunStack(client, 7), null);
  });
});

describe("stopOrphanedStack", () => {
  it("stops any run's stack but not a person's", async () => {
    const run = devHubWith("starting", "powerloom-run-3");
    const person = devHubWith("ready", null);

    await stopOrphanedStack(run.client);
    await stopOrphanedStack(person.client);

    assert.deepEqual(run.stops, ["powerloom-run-3"]);
    assert.deepEqual(person.stops, []);
  });
});

function browserWith(owner: string | null) {
  const closes: string[] = [];

  const client = {
    browserStatus: async () => ({ ok: true as const, value: { open: owner !== null, owner, case: owner ? "login" : null, url: null, title: null, expiresAt: null } }),
    closeBrowser: async (name: string) => {
      closes.push(name);

      return { ok: true as const, value: { case: "login", artifacts: [] } };
    },
  };

  return { client, closes };
}

describe("closeRunBrowser", () => {
  it("closes the case the run opened and leaves others alone", async () => {
    const own = browserWith("powerloom-run-7");
    const other = browserWith("powerloom-run-8");
    const none = browserWith(null);

    const note = await closeRunBrowser(own.client, 7);
    await closeRunBrowser(other.client, 7);
    await closeRunBrowser(none.client, 7);

    assert.equal(note, "closed the browser case of powerloom-run-7");
    assert.deepEqual([...own.closes, ...other.closes, ...none.closes], ["powerloom-run-7"]);
  });
});

describe("closeOrphanedBrowser", () => {
  it("closes any run's case but not a person's", async () => {
    const run = browserWith("powerloom-run-3");
    const person = browserWith("someone");

    await closeOrphanedBrowser(run.client);
    await closeOrphanedBrowser(person.client);

    assert.deepEqual(run.closes, ["powerloom-run-3"]);
    assert.deepEqual(person.closes, []);
  });
});

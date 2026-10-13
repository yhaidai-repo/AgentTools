import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkStackBridge } from "./checkStackBridge";
import type { StackStatus } from "./models/StackStatus";

const service = { name: "signals", note: null, localUrl: "https://localhost:7456", consumesBus: false };
const idle: StackStatus = { phase: "idle", running: false, requestedServices: [], branch: null, startedAt: null, expiresAt: null, exitCode: null, owner: null, services: [], output: [] };

describe("checkStackBridge", () => {
  it("passes when the catalog answers and names a running stack", async () => {
    const check = await checkStackBridge({
      services: async () => ({ ok: true, value: [service, service] }),
      status: async () => ({ ok: true, value: { ...idle, phase: "ready", running: true } }),
    });

    assert.deepEqual(check, { ok: true, message: "The bridge answers and accepts the token: 2 services can run. A stack is running now (ready)." });
  });

  it("fails with the bridge's reason", async () => {
    const check = await checkStackBridge({
      services: async () => ({ ok: false, message: "The stack bridge refused the token.", denied: true }),
      status: async () => ({ ok: true, value: idle }),
    });

    assert.deepEqual(check, { ok: false, message: "The stack bridge refused the token." });
  });
});

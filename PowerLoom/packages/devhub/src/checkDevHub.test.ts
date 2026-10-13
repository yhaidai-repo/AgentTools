import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDevHub } from "./checkDevHub";
import type { StackStatus } from "./models/StackStatus";

const service = { name: "signals", note: null, localUrl: "https://localhost:7456", consumesBus: false };
const idle: StackStatus = { phase: "idle", running: false, requestedServices: [], branch: null, startedAt: null, expiresAt: null, exitCode: null, owner: null, services: [], output: [] };

describe("checkDevHub", () => {
  it("passes when the catalog answers and names a running stack", async () => {
    const check = await checkDevHub({
      services: async () => ({ ok: true, value: [service, service] }),
      status: async () => ({ ok: true, value: { ...idle, phase: "ready", running: true } }),
    });

    assert.deepEqual(check, { ok: true, message: "DevHub answers and accepts the token: 2 services can run. A stack is running now (ready)." });
  });

  it("fails with DevHub's reason", async () => {
    const check = await checkDevHub({
      services: async () => ({ ok: false, message: "DevHub refused the token.", denied: true }),
      status: async () => ({ ok: true, value: idle }),
    });

    assert.deepEqual(check, { ok: false, message: "DevHub refused the token." });
  });
});

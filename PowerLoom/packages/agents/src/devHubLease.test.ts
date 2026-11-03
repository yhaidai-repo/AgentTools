import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DevHubLeases } from "./devHubLease";

const HUB = "http://host.docker.internal:3400";

describe("DevHubLeases", () => {
  it("gives a free DevHub to the first run, the same run again, and refuses a second run after its wait", async () => {
    const leases = new DevHubLeases();

    assert.deepEqual(await leases.acquire(HUB, "powerloom-run-7"), { ok: true });
    assert.deepEqual(await leases.acquire(HUB, "powerloom-run-7"), { ok: true });

    const refused = await leases.acquire(HUB, "powerloom-run-8", { waitMs: 20 });

    assert.equal(refused.ok, false);
    assert.match(refused.ok ? "" : refused.reason, /in use by powerloom-run-7/);
    assert.equal(leases.holder(HUB), "powerloom-run-7");
  });

  it("hands the DevHub to a waiting run when the holder's run ends", async () => {
    const leases = new DevHubLeases();

    await leases.acquire(HUB, "powerloom-run-7");

    const waiting = leases.acquire(HUB, "powerloom-run-8", { waitMs: 5_000 });

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(leases.release("powerloom-run-7"), [HUB]);
    assert.deepEqual(await waiting, { ok: true });
    assert.equal(leases.holder(HUB), "powerloom-run-8");
  });

  it("leases every DevHub separately and ignores a release by a run that holds nothing", async () => {
    const leases = new DevHubLeases();

    await leases.acquire(HUB, "powerloom-run-7");
    assert.deepEqual(await leases.acquire("http://other:3400", "powerloom-run-8"), { ok: true });
    assert.deepEqual(leases.release("powerloom-run-9"), []);
    assert.equal(leases.holder(HUB), "powerloom-run-7");
  });

  it("stops waiting when the waiting run is stopped", async () => {
    const leases = new DevHubLeases();
    const stop = new AbortController();

    await leases.acquire(HUB, "powerloom-run-7");

    const waiting = leases.acquire(HUB, "powerloom-run-8", { waitMs: 5_000, signal: stop.signal });

    stop.abort();

    const answer = await waiting;

    assert.equal(answer.ok, false);
    assert.match(answer.ok ? "" : answer.reason, /stopped while waiting/);
  });
});

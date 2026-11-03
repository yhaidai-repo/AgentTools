import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SandboxClient } from "@powerloom/sandbox";
import { removeOrphanedSandboxes, removeRunSandbox } from "./sandboxCleanup";

function clientRecording(calls: string[], owners: string[]): Pick<SandboxClient, "removeOwned" | "removeByPrefix" | "list"> {
  return {
    removeOwned: async (owner) => { calls.push(`owner ${owner}`); return { ok: true, value: { owners: owners.filter((candidate) => candidate === owner) } }; },
    removeByPrefix: async (prefix) => { calls.push(`prefix ${prefix}`); return { ok: true, value: { owners } }; },
    list: async (prefix) => { calls.push(`list ${prefix}`); return { ok: true, value: owners.map((owner, index) => ({ id: `sb-${index}`, owner, expiresAt: "2026-11-03T00:00:00Z" })) }; },
  };
}

describe("sandbox cleanup", () => {
  it("removes the run's own sandbox by its owner name", async () => {
    const calls: string[] = [];
    const note = await removeRunSandbox(clientRecording(calls, ["powerloom-run-7"]), 7);

    assert.deepEqual(calls, ["owner powerloom-run-7"]);
    assert.equal(note, "removed the sandbox of powerloom-run-7");
  });

  it("removes every run's sandbox at the runner's start, and says nothing when there was none", async () => {
    const calls: string[] = [];
    const note = await removeOrphanedSandboxes(clientRecording(calls, []));

    assert.deepEqual(calls, ["prefix powerloom-run-"]);
    assert.equal(note, null);
  });

  it("keeps the sandboxes of the runs in progress and removes the others one by one", async () => {
    const calls: string[] = [];
    const note = await removeOrphanedSandboxes(clientRecording(calls, ["powerloom-run-7", "powerloom-run-8", "powerloom-run-9"]), new Set(["powerloom-run-8"]));

    assert.deepEqual(calls, ["list powerloom-run-", "owner powerloom-run-7", "owner powerloom-run-9"]);
    assert.equal(note, "removed the sandbox of powerloom-run-7, powerloom-run-9");
  });

  it("reports a failure instead of throwing", async () => {
    const client = { removeOwned: async () => ({ ok: false as const, message: "down", failure: "failed" as const }), removeByPrefix: async () => ({ ok: true as const, value: { owners: [] } }), list: async () => ({ ok: true as const, value: [] }) };

    assert.equal(await removeRunSandbox(client, 7), "removing sandboxes failed: down");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { firstMessageAfter, waitForToolServer } from "./toolServerGate";

function queryReporting(statuses: string[]): Query {
  let call = 0;

  return { mcpServerStatus: async () => [{ name: "agent", status: statuses[Math.min(call++, statuses.length - 1)] }] } as unknown as Query;
}

describe("waitForToolServer", () => {
  it("answers connected once the server reports it", async () => {
    assert.equal(await waitForToolServer(queryReporting(["pending", "pending", "connected"]), "agent"), "connected");
  });

  it("gives up after the timeout while the server stays pending", async () => {
    assert.equal(await waitForToolServer(queryReporting(["pending"]), "agent", 120), "timed-out");
  });

  it("stops waiting on a failed server", async () => {
    assert.equal(await waitForToolServer(queryReporting(["failed"]), "agent"), "failed");
  });
});

describe("firstMessageAfter", () => {
  it("yields the first user message only once the gate settles", async () => {
    let release: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const stream = firstMessageAfter(ready, "Test this PBI.")[Symbol.asyncIterator]();
    let yielded = false;
    const next = stream.next().then((result) => { yielded = true; return result; });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(yielded, false);
    release();

    const first = await next;

    assert.equal(first.done, false);
    assert.deepEqual(first.value, { type: "user", message: { role: "user", content: "Test this PBI." }, parent_tool_use_id: null, session_id: "" });
    assert.equal((await stream.next()).done, true);
  });
});

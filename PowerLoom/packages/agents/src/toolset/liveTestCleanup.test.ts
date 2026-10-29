import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { AgentToolset } from "./AgentToolset";
import { DuplicateGuard } from "../DuplicateGuard";
import { fakeLiveTestContext } from "../liveTest/fakeLiveTestContext";
import { LiveTestRun } from "../liveTest/LiveTestRun";
import { LiveTestScope } from "../liveTest/LiveTestScope";

function toolsetWith(liveTest: LiveTestRun | null, phase: (name: string, detail: Record<string, unknown>) => Promise<void>): AgentToolset {
  const context = { deps: { db: {}, docsVaultName: "demo" }, agent: { id: "powerloom-selftest", capabilities: { integrations: {} } } };
  const session = { runId: 7, phase };

  return Reflect.construct(AgentToolset, [context, session, { id: "AT-1", pbiId: null, vault: "demo" }, { repos: { repos: [] }, writers: [], liveTest }, null, DuplicateGuard.none(), { depth: 1 }]) as AgentToolset;
}

async function runCreating(calls: string[]): Promise<LiveTestRun> {
  const run = LiveTestRun.on(fakeLiveTestContext(calls), new LiveTestScope(async () => undefined));
  const create = run.tools(new Set()).writes.find((tool) => tool.name === "pbi_create")!;

  await create.handler({ vault: "personal-projects", title: "[selftest] toolset" });

  return run;
}

describe("AgentToolset.cleanUpLiveTest", () => {
  it("removes what the run created, records the live-test-cleanup phase and is a no-op afterwards", async () => {
    const calls: string[] = [];
    const phases: { name: string; detail: Record<string, unknown> }[] = [];
    const toolset = toolsetWith(await runCreating(calls), async (name, detail) => void phases.push({ name, detail }));

    await toolset.cleanUpLiveTest();
    await toolset.cleanUpLiveTest();

    assert.deepEqual(calls, ["createPbi", "deletePbi 901"]);
    assert.deepEqual(phases, [{ name: "live-test-cleanup", detail: { removed: ["pbi 901"], failed: [] } }]);
  });

  it("does nothing for an agent without the grant or a run that created nothing", async () => {
    const phases: string[] = [];
    const empty = LiveTestRun.on(fakeLiveTestContext([]), new LiveTestScope(async () => undefined));

    await toolsetWith(null, async (name) => void phases.push(name)).cleanUpLiveTest();
    await toolsetWith(empty, async (name) => void phases.push(name)).cleanUpLiveTest();

    assert.deepEqual(phases, []);
  });

  it("never throws, even when the trace can't be written", async () => {
    const logged = mock.method(console, "error", () => {});
    const toolset = toolsetWith(await runCreating([]), async () => {
      throw new Error("trace is down");
    });

    await assert.doesNotReject(toolset.cleanUpLiveTest());
    assert.match(String(logged.mock.calls[0]?.arguments[0]), /live-test cleanup of RUN-7 failed: trace is down/);
    logged.mock.restore();
  });
});

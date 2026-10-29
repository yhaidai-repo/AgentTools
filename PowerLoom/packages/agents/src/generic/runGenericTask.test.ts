import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { AgentRunSession } from "../AgentRunSession";
import type { TaskContext } from "../models/TaskContext";
import { AgentToolset } from "../toolset/AgentToolset";
import { runGenericTask } from "./runGenericTask";

// A database that answers every query with no rows.
function emptyDb(): unknown {
  const answer: unknown = new Proxy(() => {}, {
    get: (_target, key) => (key === "then" ? (resolve: (rows: unknown[]) => void) => resolve([]) : answer),
    apply: () => answer,
  });

  return answer;
}

function fakes(events: string[], executeFails = false) {
  const session = {
    runId: 5,
    phase: async () => {},
    execute: async (_info: unknown, prepare: () => Promise<unknown>) => {
      await prepare();
      events.push("execute");

      if (executeFails) {
        throw new Error("the run broke");
      }

      return { outcome: "failed", runId: 5, costUsd: 0, error: null };
    },
    finish: async (result: unknown) => {
      events.push("finish");

      return result;
    },
  };
  const toolset = {
    cleanUpLiveTest: async () => void events.push("cleanUpLiveTest"),
    cleanUp: async () => void events.push("cleanUp"),
    contextBlocks: async () => [],
    webDocumentsBlock: () => "",
    promptSections: async () => [],
    tools: () => [],
    offered: [],
    observe: () => {},
    commit: async () => ({ taskIds: [] }),
    settlements: () => [],
    result: { isWritten: true, latest: null },
    meter: { lastWords: "" },
  };

  mock.method(AgentRunSession, "begin", async () => session);
  mock.method(AgentToolset, "open", async () => toolset);
}

const CONTEXT = {
  deps: { db: emptyDb(), docsRoot: "/docs", docsVaultName: "demo", vaultRoot: "/docs", repoCache: { release: () => {} } },
  agent: { id: "powerloom-selftest", model: { provider: "anthropic", model: "m" }, capabilities: { integrations: {} }, limits: { maxTurns: 1, timeoutMinutes: 1 }, budgets: { perRunUsd: 1 } },
  prompt: { version: 1, text: "p" },
  skills: { promptSection: "" },
} as unknown as TaskContext;
const TASK = { id: "AT-1", kind: "test", title: "t", body: "", pbiId: null, vault: "demo", data: {} } as never;

describe("runGenericTask", () => {
  afterEach(() => mock.restoreAll());

  it("cleans the live test up after the run and before it finishes, then again as the safety net", async () => {
    const events: string[] = [];

    fakes(events);
    await runGenericTask(CONTEXT, TASK);

    assert.deepEqual(events, ["execute", "cleanUpLiveTest", "finish", "cleanUpLiveTest", "cleanUp"]);
  });

  it("still cleans the live test up when the run breaks before it finishes", async () => {
    const events: string[] = [];

    fakes(events, true);
    await assert.rejects(runGenericTask(CONTEXT, TASK), /the run broke/);

    assert.deepEqual(events, ["execute", "cleanUpLiveTest", "cleanUp"]);
  });
});

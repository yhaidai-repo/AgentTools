import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { AgentDeps } from "../models/AgentDeps";
import { fakeLiveTestContext } from "./fakeLiveTestContext";
import { LiveTestRun } from "./LiveTestRun";
import { LIVE_TEST_INTEGRATION } from "./liveTestTools";
import { LiveTestScope } from "./LiveTestScope";

function agentWith(integrations: Record<string, boolean>): AgentDefinition {
  return { id: "powerloom-selftest", capabilities: { webAccess: false, integrations } } as unknown as AgentDefinition;
}

const DEPS = { db: {}, config: {}, usageStore: {}, skillFolders: ["/skills"], vaultRoot: "/vault/personal-projects", powerloomUrl: "http://powerloom:8080", vaults: { root: "/vaults" } } as unknown as AgentDeps;

describe("LiveTestRun", () => {
  it("exists only for an agent with the grant", () => {
    assert.equal(LiveTestRun.granted(agentWith({ readRepos: true }), DEPS), null);
    assert.notEqual(LiveTestRun.granted(agentWith({ readRepos: true, [LIVE_TEST_INTEGRATION]: true }), DEPS), null);
  });

  it("gives the reads and the guarded writes as tools, without a name the run already has", () => {
    const run = LiveTestRun.granted(agentWith({ [LIVE_TEST_INTEGRATION]: true }), DEPS)!;

    const { reads, writes } = run.tools(new Set(["sql_query"]));
    const names = [...reads, ...writes].map((tool) => tool.name);

    assert.equal(names.includes("sql_query"), false);
    assert.equal(reads.some((tool) => tool.name === "pbi_read"), true);
    assert.deepEqual(writes.filter((tool) => ["pbi_create", "item_delete", "agent_update"].includes(tool.name)).length, 3);
    assert.equal(names.includes("agent_run"), false);
    assert.equal(names.includes("register_add"), false);
    assert.equal(names.filter((name, index) => names.indexOf(name) !== index).length, 0);
  });

  it("removes what the run created at its end, and holds nothing after", async () => {
    const calls: string[] = [];
    const scope = new LiveTestScope(async () => undefined);
    const run = LiveTestRun.on(fakeLiveTestContext(calls), scope);
    const create = run.tools(new Set()).writes.find((tool) => tool.name === "pbi_create")!;

    await create.handler({ vault: "personal-projects", title: "[selftest] cleanup" });

    assert.equal(run.holdsData, true);
    assert.deepEqual(await run.cleanUp(), { removed: ["pbi 901"], failed: [] });
    assert.equal(run.holdsData, false);
    assert.deepEqual(calls, ["createPbi", "deletePbi 901"]);
  });
});

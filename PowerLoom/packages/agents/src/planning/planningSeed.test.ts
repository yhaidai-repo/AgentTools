import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolPolicyCall } from "@agenttools/runtime";
import { planningDocsOnly } from "./planningDocsOnly";
import { PBI_CONTEXT_FILE, planningSeed } from "./planningSeed";
import { pbiBranch, workspaceBlock } from "./planningWorkspace";

function call(name: string, input: unknown): ToolPolicyCall {
  return { callId: "c1", name, input, taskId: null, agentType: null };
}

describe("planningSeed", () => {
  it("puts the decided models on GSD's sub-agents: Opus where the plan is made and checked, Haiku for the fan-out", () => {
    const overrides = planningSeed("ctx").config.model_overrides as Record<string, string>;

    assert.equal(overrides["gsd-planner"], "claude-opus-5-5");
    assert.equal(overrides["gsd-plan-checker"], "claude-opus-5-5");
    assert.equal(overrides["gsd-codebase-mapper"], "claude-haiku-5-5");
    assert.equal(overrides["gsd-pattern-mapper"], "claude-haiku-5-5");
    assert.equal(overrides["gsd-phase-researcher"], "claude-haiku-5-5");
  });

  it("keeps planning docs out of commits, checks plans and never advances into execution", () => {
    const config = planningSeed("ctx").config;

    assert.equal(config.commit_docs, false);
    assert.deepEqual(config.workflow, { research: true, plan_check: true, auto_advance: false, text_mode: true, skip_discuss: false });
  });

  it("writes the PBI context as the file GSD starts from", () => {
    assert.deepEqual(planningSeed("# PBI-1\nArchive orders.").files, [{ path: PBI_CONTEXT_FILE, content: "# PBI-1\nArchive orders." }]);
  });
});

describe("pbiBranch", () => {
  it("is the PBI's own branch, or its parent's for a child item", () => {
    assert.equal(pbiBranch({ adoId: 41, parentId: null }), "powerloom/pbi-41");
    assert.equal(pbiBranch({ adoId: 42, parentId: 41 }), "powerloom/pbi-41");
  });
});

describe("workspaceBlock", () => {
  it("names the repo and branch, or tells the agent there is nothing to plan in", () => {
    const block = workspaceBlock({ repo: { name: "shop", remoteUrl: "https://example.invalid/shop", defaultBranch: "main" }, branch: "powerloom/pbi-41", baseBranch: "main", gsd: true });

    assert.match(block, /Repo: shop\nBranch: powerloom\/pbi-41 \(from main\)/);
    assert.match(workspaceBlock(null), /no enabled repo/);
  });
});

describe("planningDocsOnly", () => {
  it("lets GSD write its documents under .planning", async () => {
    assert.deepEqual(await planningDocsOnly(call("Write", { file_path: "D:/wt/shop/.planning/phases/01-x/01-01-PLAN.md" })), { allow: true });
    assert.deepEqual(await planningDocsOnly(call("Edit", { file_path: ".planning\\STATE.md" })), { allow: true });
  });

  it("refuses an edit of code, a sub-agent's too", async () => {
    const decision = await planningDocsOnly({ ...call("Edit", { file_path: "D:/wt/shop/src/Orders/OrderArchiver.cs" }), taskId: "t1", agentType: "gsd-planner" });

    assert.equal(decision.allow, false);
    assert.match((decision as { reason: string }).reason, /read-only on code/);
  });

  it("leaves reads and other tools to the runtime's own guards", async () => {
    assert.deepEqual(await planningDocsOnly(call("Read", { file_path: "D:/wt/shop/src/Orders/OrderArchiver.cs" })), { allow: true });
    assert.deepEqual(await planningDocsOnly(call("Bash", { command: "git status" })), { allow: true });
  });
});

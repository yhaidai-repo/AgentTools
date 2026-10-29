import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolPolicyCall } from "@agenttools/runtime";
import { implementationBlock } from "./implementationBlock";
import { DEFAULT_IMPLEMENTATION_MODELS, implementationModels, implementationSeed } from "./implementationSeed";
import { implementationPolicy } from "./implementationPolicy";
import { repoCommands } from "./prepareImplementation";
import { WORKTREE_SHELL_CONTRACT, WORKTREE_SHELL_SKILL_FILE } from "./worktreeShellContract";

const COMMANDS = { build: "dotnet build Shop.sln", test: "dotnet test Shop.sln" };

function call(name: string, input: unknown): ToolPolicyCall {
  return { callId: "c1", name, input, taskId: null, agentType: null };
}

describe("implementationSeed", () => {
  it("puts the run's executor and verifier models on GSD's execution sub-agents and Haiku on the mappers", () => {
    const overrides = implementationSeed({ executor: "claude-sonnet-5-5", verifier: "claude-opus-5-5" }, COMMANDS).config.model_overrides as Record<string, string>;

    assert.equal(overrides["gsd-executor"], "claude-sonnet-5-5");
    assert.equal(overrides["gsd-code-fixer"], "claude-sonnet-5-5");
    assert.equal(overrides["gsd-verifier"], "claude-opus-5-5");
    assert.equal(overrides["gsd-code-reviewer"], "claude-opus-5-5");
    assert.equal(overrides["gsd-codebase-mapper"], "claude-haiku-5-5");
  });

  it("executes unattended in the run's worktree with docs out of commits and the repo's configured commands", () => {
    const config = implementationSeed(DEFAULT_IMPLEMENTATION_MODELS, COMMANDS).config;

    assert.equal(config.mode, "yolo");
    assert.equal(config.commit_docs, false);
    assert.deepEqual(config.workflow, { auto_advance: false, text_mode: true, use_worktrees: false, verifier: true, build_command: "dotnet build Shop.sln", test_command: "dotnet test Shop.sln" });
  });

  it("leaves GSD's command defaults when the repo has none configured", () => {
    const seed = implementationSeed(DEFAULT_IMPLEMENTATION_MODELS, { build: null, test: null });

    assert.deepEqual(seed.config.workflow, { auto_advance: false, text_mode: true, use_worktrees: false, verifier: true });
  });

  it("gives GSD's executors and verifiers the worktree shell contract as a skill", () => {
    const seed = implementationSeed(DEFAULT_IMPLEMENTATION_MODELS, COMMANDS);
    const skills = seed.config.agent_skills as Record<string, string[]>;

    assert.deepEqual(seed.files, [WORKTREE_SHELL_SKILL_FILE]);
    assert.deepEqual(skills["gsd-executor"], [".planning/skills/powerloom-worktree-shell"]);
    assert.deepEqual(skills["gsd-verifier"], [".planning/skills/powerloom-worktree-shell"]);
    assert.ok(WORKTREE_SHELL_SKILL_FILE.content.includes(WORKTREE_SHELL_CONTRACT));
  });
});

describe("implementationModels", () => {
  it("runs Opus 5.5 unless the task's data sets another executor or verifier", () => {
    assert.deepEqual(implementationModels(null), { executor: "claude-opus-5-5", verifier: "claude-opus-5-5" });
    assert.deepEqual(implementationModels({ gsdModels: { executor: "claude-sonnet-5-5" } }), { executor: "claude-sonnet-5-5", verifier: "claude-opus-5-5" });
    assert.deepEqual(implementationModels({ gsdModels: { executor: 7, verifier: "" } }), DEFAULT_IMPLEMENTATION_MODELS);
  });
});

describe("repoCommands", () => {
  it("finds the repo's commands by its catalogue name, whatever the case", () => {
    const settings = { repos: { "Shop API": { build: "dotnet build", test: "" } } };

    assert.deepEqual(repoCommands(settings, { name: "Shop-API", catalogName: "shop api" }), { build: "dotnet build", test: null });
    assert.deepEqual(repoCommands(settings, { name: "Other", catalogName: "Other" }), { build: null, test: null });
  });
});

describe("implementationBlock", () => {
  const workspace = { repo: { name: "shop", remoteUrl: "https://example.invalid/shop", defaultBranch: "main" }, branch: "powerloom/pbi-7", baseBranch: "main", gsd: true };

  it("tells an approved run where it builds and with which commands", () => {
    const block = implementationBlock({ outcome: { kind: "approved", reviewId: "HT-7-002", planVersion: 2 }, workspace, commands: { build: "dotnet build", test: null } });

    assert.match(block, /HT-7-002 approved plan v2/);
    assert.match(block, /Branch: powerloom\/pbi-7 \(from main\); commit locally only, never push\./);
    assert.match(block, /Build command: `dotnet build`\nTest command: none configured/);
    assert.ok(block.includes(WORKTREE_SHELL_CONTRACT));
  });

  it("sends a run with changes back to planning with the changes as written, and stops a blocked one", () => {
    const replan = implementationBlock({ outcome: { kind: "replan", reviewId: "HT-7-002", reason: "HT-7-002 asked for changes", corrections: "changes: archive after 30 days" }, workspace: null, commands: { build: null, test: null } });
    const blocked = implementationBlock({ outcome: { kind: "blocked", reason: "HT-7-002 was cancelled: the review never approved the plan." }, workspace: null, commands: { build: null, test: null } });

    assert.match(replan, /hand_off to `design` with intent continue/);
    assert.match(replan, /Changes:\nchanges: archive after 30 days/);
    assert.match(blocked, /^<implementation outcome="blocked">\nHT-7-002 was cancelled/);
  });
});

describe("implementationPolicy", () => {
  it("lets the agent edit code and GSD's documents but not the run's config", async () => {
    const refused = await implementationPolicy(call("Write", { file_path: "D:/wt/shop/.planning/config.json" }));

    assert.deepEqual(await implementationPolicy(call("Edit", { file_path: "D:/wt/shop/src/Orders/OrderArchiver.cs" })), { allow: true });
    assert.deepEqual(await implementationPolicy(call("Write", { file_path: ".planning/phases/01-x/01-UAT.md" })), { allow: true });
    assert.equal(refused.allow, false);
  });

  it("refuses GSD's ship step and lets its other commands run", async () => {
    const refused = await implementationPolicy(call("Skill", { skill: "gsd-ship", args: "1" }));

    assert.equal(refused.allow, false);
    assert.match((refused as { reason: string }).reason, /never pushes or opens a pull request/);
    assert.deepEqual(await implementationPolicy(call("Skill", { skill: "gsd-execute-phase", args: "1" })), { allow: true });
  });
});

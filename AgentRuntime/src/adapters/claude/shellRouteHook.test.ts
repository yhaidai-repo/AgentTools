import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { HookCallback, PreToolUseHookInput, PreToolUseHookSpecificOutput, SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import type { ShellRoute } from "../../models/ShellRoute";
import { RunAbort } from "../../RunAbort";
import { buildSdkOptions } from "./sdkOptions";
import { toolPolicyHook } from "./toolPolicyHook";

const WORKTREE = "D:/worktrees/app";
const routeBuilds: ShellRoute = { run: async (command) => command.startsWith("dotnet test") ? { exitCode: 1, output: "Failed App.Tests.Adds [3 ms]\nFailed!  - Failed: 1" } : null };

function preToolUse(fields: Partial<PreToolUseHookInput> = {}): PreToolUseHookInput {
  return { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "dotnet test", timeout: 300_000 }, tool_use_id: "toolu_9", session_id: "s", transcript_path: "", cwd: WORKTREE, ...fields };
}

async function decide(hook: HookCallback, input: PreToolUseHookInput): Promise<PreToolUseHookSpecificOutput> {
  const output = await hook(input, input.tool_use_id, { signal: new AbortController().signal }) as SyncHookJSONOutput;

  return output.hookSpecificOutput as PreToolUseHookSpecificOutput;
}

function commandOf(specific: PreToolUseHookSpecificOutput): string {
  return String(specific.updatedInput?.command ?? "");
}

function replayFile(command: string): string {
  return /^cat -- '([^']+)'/.exec(command)?.[1] ?? "";
}

describe("a shell route in the tool policy hook", () => {
  it("answers a routed command with a replay of its output and exit code, before the policy refuses it", async () => {
    const hook = toolPolicyHook(() => ({ allow: false, reason: "dotnet is not allowed in the worktree's shell" }), routeBuilds);
    const specific = await decide(hook, preToolUse());
    const file = replayFile(commandOf(specific));

    assert.equal(specific.permissionDecision, "allow");
    assert.match(commandOf(specific), /; exit 1$/);
    assert.equal(specific.updatedInput?.timeout, 300_000);
    assert.equal(readFileSync(file, "utf8"), "Failed App.Tests.Adds [3 ms]\nFailed!  - Failed: 1");
  });

  it("passes the shell's folder and the call's timeout to the route", async () => {
    const seen: unknown[] = [];
    const hook = toolPolicyHook(() => ({ allow: true }), { run: async (...args) => { seen.push(args); return null; } });

    await decide(hook, preToolUse({ tool_input: { command: "dotnet build" } }));

    assert.deepEqual(seen, [["dotnet build", WORKTREE, null]]);
  });

  it("leaves a command the route doesn't take, and every other tool, to the policy", async () => {
    const hook = toolPolicyHook(() => ({ allow: false, reason: "make is not allowed" }), routeBuilds);
    const shell = await decide(hook, preToolUse({ tool_input: { command: "make" } }));
    const edit = await decide(hook, preToolUse({ tool_name: "Edit", tool_input: { file_path: "a.cs" } }));

    assert.equal(shell.permissionDecision, "deny");
    assert.equal(edit.permissionDecision, "deny");
  });

  it("denies a command whose route failed, so it never runs in the run's own shell", async () => {
    const hook = toolPolicyHook(() => ({ allow: true }), { run: async () => { throw new Error("the sandbox service doesn't answer"); } });
    const specific = await decide(hook, preToolUse());

    assert.equal(specific.permissionDecision, "deny");
    assert.match(specific.permissionDecisionReason ?? "", /sandbox service doesn't answer/);
  });

  it("gets the hook, with room for a long build, even on a run with no policy", () => {
    const abort = new RunAbort(2000);
    const request: AgentRequest = { runId: "run-1", model: { provider: "anthropic", model: "claude-opus-5-5", effort: "high" }, systemPrompt: "system", firstMessage: "hello", tools: [], limits: { maxTurns: 10, timeoutMs: 2000 }, shellRoute: routeBuilds };

    try {
      const options = buildSdkOptions(request, abort, { projectDir: WORKTREE, conversation: undefined, apiProxied: false });

      assert.equal(options.hooks?.PreToolUse?.length, 1);
      assert.ok((options.hooks?.PreToolUse?.[0].timeout ?? 0) >= 30 * 60);
    } finally {
      abort.dispose();
    }
  });

  it("names a replay file that is gone once the replay ran", async () => {
    const hook = toolPolicyHook(() => ({ allow: true }), routeBuilds);
    const command = commandOf(await decide(hook, preToolUse()));

    assert.match(command, /rm -f -- '[^']+'/);
    assert.ok(existsSync(replayFile(command)));
  });
});

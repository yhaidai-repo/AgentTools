import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import { RunAbort } from "../../RunAbort";
import { childEnv } from "./childEnv";
import { buildSdkOptions } from "./sdkOptions";
import { toolPolicyHook } from "./toolPolicyHook";

const PROJECT_DIR = "D:/host";

function request(fields: Partial<AgentRequest> = {}): AgentRequest {
  return { runId: "run-1", model: { provider: "anthropic", model: "claude-opus-5-5", effort: "high" }, systemPrompt: "system", firstMessage: "hello", tools: [], limits: { maxTurns: 10, timeoutMs: 2000 }, ...fields };
}

function optionsFor(fields: Partial<AgentRequest> = {}) {
  const abort = new RunAbort(2000);

  try {
    return buildSdkOptions(request(fields), abort, PROJECT_DIR, undefined);
  } finally {
    abort.dispose();
  }
}

function preToolUse(fields: Partial<PreToolUseHookInput> = {}): PreToolUseHookInput {
  return { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "toolu_1", session_id: "s", transcript_path: "", cwd: "", ...fields };
}

async function decide(hook: HookCallback, input: PreToolUseHookInput) {
  return hook(input, input.tool_use_id, { signal: new AbortController().signal });
}

describe("buildSdkOptions", () => {
  it("keeps today's options when the request has no folder, settings or policy", () => {
    const options = optionsFor();

    assert.equal(options.cwd, PROJECT_DIR);
    assert.deepEqual(options.settingSources, []);
    assert.deepEqual(options.tools, []);
    assert.equal(options.hooks, undefined);
    assert.equal(options.persistSession, false);
    assert.deepEqual(options.settings, { autoMemoryEnabled: false });
  });

  it("takes the request's folder and setting sources", () => {
    const options = optionsFor({ cwd: "D:/runs/run-1", settingSources: ["project", "local"] });

    assert.equal(options.cwd, "D:/runs/run-1");
    assert.deepEqual(options.settingSources, ["project", "local"]);
  });

  it("registers the tool policy as a PreToolUse hook", () => {
    const options = optionsFor({ toolPolicy: () => ({ allow: true }) });

    assert.equal(options.hooks?.PreToolUse?.length, 1);
  });

  it("names this runtime as the SDK client", () => {
    assert.equal(optionsFor().env?.CLAUDE_AGENT_SDK_CLIENT_APP, "agenttools-runtime/1.0");
  });
});

describe("childEnv", () => {
  it("drops a parent Claude Code session's variables and keeps the OAuth token", () => {
    const env = childEnv({
      PATH: "/bin",
      CLAUDE_CONFIG_DIR: "/claude",
      CLAUDE_CODE_OAUTH_TOKEN: "token",
      CLAUDECODE: "1",
      CLAUDE_CODE_ENTRYPOINT: "claude-desktop",
      CLAUDE_AGENT_SDK_VERSION: "0.3.286",
      ANTHROPIC_BASE_URL: "http://localhost:1234",
    }, "app/1.0");

    assert.deepEqual(env, { PATH: "/bin", CLAUDE_CONFIG_DIR: "/claude", CLAUDE_CODE_OAUTH_TOKEN: "token", CLAUDE_AGENT_SDK_CLIENT_APP: "app/1.0" });
  });
});

describe("toolPolicyHook", () => {
  it("passes a sub-agent's call to the policy with its task id and type", async () => {
    const seen: unknown[] = [];
    const hook = toolPolicyHook((call) => { seen.push(call); return { allow: true }; });

    const output = await decide(hook, preToolUse({ tool_name: "Task", agent_id: "a09e", agent_type: "gsd-roadmapper" }));

    assert.deepEqual(output, {});
    assert.deepEqual(seen, [{ callId: "toolu_1", name: "Agent", input: { command: "ls" }, taskId: "a09e", agentType: "gsd-roadmapper" }]);
  });

  it("gives a main-session call no task id or agent type", async () => {
    const seen: unknown[] = [];
    const hook = toolPolicyHook((call) => { seen.push(call); return { allow: true }; });

    await decide(hook, preToolUse({ tool_name: "mcp__agent__read_pbi", agent_type: "main-agent" }));

    assert.deepEqual(seen, [{ callId: "toolu_1", name: "read_pbi", input: { command: "ls" }, taskId: null, agentType: null }]);
  });

  it("denies a call the policy refuses, with its reason", async () => {
    const hook = toolPolicyHook(async () => ({ allow: false, reason: "Bash is not allowed here." }));

    const output = await decide(hook, preToolUse());

    assert.deepEqual(output, { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Bash is not allowed here." } });
  });
});

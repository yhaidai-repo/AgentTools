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
    return buildSdkOptions(request(fields), abort, { projectDir: PROJECT_DIR, conversation: undefined, apiProxied: false });
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

  it("offers and allows Skill when the run loads its folder's project settings, so the folder's commands can run", () => {
    const options = optionsFor({ cwd: "D:/runs/run-1", settingSources: ["project", "local"], capabilities: { readCode: true } });

    assert.deepEqual(options.tools, ["Read", "Grep", "Glob", "Skill"]);
    assert.deepEqual(options.allowedTools, ["Read", "Grep", "Glob", "Skill"]);
  });

  it("offers no Skill when only local settings load", () => {
    const options = optionsFor({ settingSources: ["local"] });

    assert.deepEqual(options.tools, []);
  });

  it("registers the tool policy as a PreToolUse hook", () => {
    const options = optionsFor({ toolPolicy: () => ({ allow: true }) });

    assert.equal(options.hooks?.PreToolUse?.length, 1);
  });

  it("guards secrets by default when the run has built-in tools", async () => {
    const options = optionsFor({ capabilities: { webAccess: true } });
    const [hook] = options.hooks?.PreToolUse?.[0].hooks ?? [];

    const output = await decide(hook, preToolUse({ tool_name: "Read", tool_input: { file_path: "D:/repo/.env" } }));

    assert.equal((output as { hookSpecificOutput?: { permissionDecision?: string } }).hookSpecificOutput?.permissionDecision, "deny");
  });

  it("keeps a read-only run in dontAsk with its granted tools allowed", () => {
    const options = optionsFor({ capabilities: { readCode: true, subAgents: true } });

    assert.equal(options.permissionMode, "dontAsk");
    assert.deepEqual(options.tools, ["Read", "Grep", "Glob", "Agent"]);
    assert.deepEqual(options.allowedTools, ["Read", "Grep", "Glob", "Agent"]);
  });

  it("lets a run that edits accept edits in its folder without allowing them everywhere", () => {
    const options = optionsFor({ cwd: "D:/runs/run-1", capabilities: { readCode: true, editCode: true, shell: true } });

    assert.equal(options.permissionMode, "acceptEdits");
    assert.equal(options.allowDangerouslySkipPermissions, undefined);
    assert.deepEqual(options.tools, ["Read", "Grep", "Glob", "Edit", "Write", "NotebookEdit", "Bash"]);
    assert.deepEqual(options.allowedTools, ["Read", "Grep", "Glob", "Bash"]);
  });

  it("guards secrets, the folder and publishing for a run that edits, under the request's own policy too", async () => {
    const options = optionsFor({ cwd: "D:/runs/run-1", capabilities: { editCode: true, shell: true }, toolPolicy: (call) => (call.name === "Bash" ? { allow: false, reason: "no shell" } : { allow: true }) });
    const [hook] = options.hooks?.PreToolUse?.[0].hooks ?? [];
    const reasonOf = async (input: Partial<PreToolUseHookInput>) => ((await decide(hook, preToolUse(input))) as { hookSpecificOutput?: { permissionDecisionReason?: string } }).hookSpecificOutput?.permissionDecisionReason;

    assert.match(await reasonOf({ tool_name: "Write", tool_input: { file_path: "D:/runs/run-1/.env" } }) ?? "", /secret file/);
    assert.match(await reasonOf({ tool_name: "Write", tool_input: { file_path: "D:/runs/run-2/a.ts" } }) ?? "", /outside the run's folder/);
    assert.match(await reasonOf({ tool_name: "Bash", tool_input: { command: "git push" } }) ?? "", /git push is not allowed/);
    assert.equal(await reasonOf({ tool_name: "Bash", tool_input: { command: "git status" } }), "no shell");
    assert.equal(await reasonOf({ tool_name: "Edit", tool_input: { file_path: "D:/runs/run-1/a.ts" } }), undefined);
  });

  it("guards the host's folder when the run has none of its own", async () => {
    const options = optionsFor({ capabilities: { editCode: true } });
    const [hook] = options.hooks?.PreToolUse?.[0].hooks ?? [];

    const output = await decide(hook, preToolUse({ tool_name: "Write", tool_input: { file_path: "D:/other/a.ts" } }));

    assert.equal((output as { hookSpecificOutput?: { permissionDecision?: string } }).hookSpecificOutput?.permissionDecision, "deny");
  });

  it("adds the request's variables to the agent's environment", () => {
    const options = optionsFor({ env: { GIT_AUTHOR_NAME: "PowerLoom agent" } });

    assert.equal(options.env?.GIT_AUTHOR_NAME, "PowerLoom agent");
    assert.equal(options.env?.CLAUDE_AGENT_SDK_CLIENT_APP, "agenttools-runtime/1.0");
  });

  it("names this runtime as the SDK client", () => {
    assert.equal(optionsFor().env?.CLAUDE_AGENT_SDK_CLIENT_APP, "agenttools-runtime/1.0");
  });
});

describe("childEnv", () => {
  const parentEnv = {
    PATH: "/bin",
    CLAUDE_CONFIG_DIR: "/claude",
    CLAUDE_CODE_OAUTH_TOKEN: "token",
    CLAUDECODE: "1",
    CLAUDE_CODE_ENTRYPOINT: "claude-desktop",
    CLAUDE_AGENT_SDK_VERSION: "0.3.286",
    ANTHROPIC_BASE_URL: "http://localhost:1234",
  };

  it("drops a parent Claude Code session's variables and keeps the OAuth token", () => {
    const env = childEnv(parentEnv, "app/1.0", false);

    assert.deepEqual(env, { PATH: "/bin", CLAUDE_CONFIG_DIR: "/claude", CLAUDE_CODE_OAUTH_TOKEN: "token", CLAUDE_AGENT_SDK_CLIENT_APP: "app/1.0" });
  });

  it("keeps ANTHROPIC_BASE_URL when the host proxies the API", () => {
    const env = childEnv(parentEnv, "app/1.0", true);

    assert.equal(env.ANTHROPIC_BASE_URL, "http://localhost:1234");
    assert.equal(env.CLAUDECODE, undefined);
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

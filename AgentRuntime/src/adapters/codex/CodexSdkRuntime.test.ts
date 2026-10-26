import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { CodexOptions, ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import type { AgentEvent } from "../../models/AgentEvent";
import { CodexSdkRuntime } from "./CodexSdkRuntime";
import type { CodexClientFactory } from "./models/CodexClientFactory";

const usage = { input_tokens: 30_629, cached_input_tokens: 18_560, cache_write_input_tokens: 12, output_tokens: 228, reasoning_output_tokens: 100 };
const success: ThreadEvent[] = [
  { type: "thread.started", thread_id: "thread-1" },
  { type: "item.completed", item: { id: "message", type: "agent_message", text: "done" } },
  { type: "turn.completed", usage },
];

function request(): AgentRequest {
  return { runId: "run-1", model: { provider: "openai-codex", model: "model-test", effort: "high" }, systemPrompt: "system", firstMessage: "hello", tools: [], limits: { maxTurns: 10, timeoutMs: 2000 } };
}

async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const collected: AgentEvent[] = [];

  for await (const event of events) {
    collected.push(event);
  }

  return collected;
}

function fake(events: ThreadEvent[], wait = false, crash = false): CodexClientFactory {
  return () => {
    const thread = {
      async runStreamed(_input: string, { signal }: { signal: AbortSignal }) {
        return { events: stream(events, signal, wait, crash) };
      },
    };

    return { startThread: () => thread, resumeThread: () => thread };
  };
}

async function* stream(events: ThreadEvent[], signal: AbortSignal, wait: boolean, crash: boolean): AsyncIterable<ThreadEvent> {
  yield* events;

  if (crash) {
    throw new Error("child process crashed");
  }

  if (wait) {
    await delay(10_000, undefined, { signal });
  }
}

for (const [name, events, expected] of [
  ["success", success, "success"],
  ["failed turn", [{ type: "turn.failed", error: { message: "failed" } }], "failed"],
  ["rate limit", [{ type: "error", message: "Usage limit reached" }], "rate-limited"],
  ["empty stream", [], "failed"],
  ["fatal error followed by completion", [{ type: "error", message: "tool host disabled" }, ...success], "failed"],
] as const) {
  test("ends exactly once on " + name, async () => {
    const home = await mkdtemp(join(tmpdir(), "codex-runtime-test-"));

    try {
      const runtime = new CodexSdkRuntime({ codexHome: home }, fake([...events]));
      const result = await collect(runtime.run(request()));

      assert.equal(result.filter((event) => event.type === "result").length, 1);
      assert.equal(result.at(-1)?.type, "result");
      assert.equal((result.at(-1) as { reason: string }).reason, expected);
      assert.deepEqual(result.map((event) => event.seq), result.map((_, index) => index + 1));
      assert.ok(result.every((event) => event.runId === "run-1" && event.at instanceof Date));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
}

for (const mode of ["aborted", "timeout", "max-turns", "crashed"] as const) {
  test("ends exactly once when " + mode, async () => {
    const home = await mkdtemp(join(tmpdir(), "codex-runtime-test-"));
    const controller = new AbortController();
    const input = { ...request(), signal: controller.signal, limits: { maxTurns: mode === "max-turns" ? 0 : 10, timeoutMs: mode === "timeout" ? 50 : 2000 } };
    const timer = mode === "aborted" ? setTimeout(() => controller.abort(), 50) : null;

    try {
      const runtime = new CodexSdkRuntime({ codexHome: home }, fake(success.slice(0, 2), mode === "aborted" || mode === "timeout", mode === "crashed"));
      const events = await collect(runtime.run(input));
      const result = events.filter((event) => event.type === "result");

      assert.equal(result.length, 1);
      assert.equal(result[0].reason, mode === "crashed" ? "failed" : mode);
      assert.equal(events.at(-1), result[0]);
    } finally {
      clearTimeout(timer ?? undefined);
      await rm(home, { recursive: true, force: true });
    }
  });
}

test("reports the tokens of a run cut off at its turn limit, from the rollout", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-runtime-test-"));
  const total = (input: number, output: number) => JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: 0, output_tokens: output } } } });
  const messages: ThreadEvent[] = [
    { type: "thread.started", thread_id: "thread-cut" },
    { type: "item.completed", item: { id: "m1", type: "agent_message", text: "reading" } },
    { type: "item.completed", item: { id: "m2", type: "agent_message", text: "still reading" } },
  ];

  try {
    await mkdir(join(home, "sessions"), { recursive: true });
    await writeFile(join(home, "sessions", "rollout-date-thread-cut.jsonl"), [total(800, 40), total(2_000, 90)].join("\n"));

    const runtime = new CodexSdkRuntime({ codexHome: home }, fake(messages, true));
    const events = await collect(runtime.run({ ...request(), limits: { maxTurns: 1, timeoutMs: 2000 } }));
    const usage = events.filter((event) => event.type === "usage");

    assert.equal((events.at(-1) as { reason: string }).reason, "max-turns");
    assert.deepEqual(usage.map((event) => [event.inputTokens, event.outputTokens]), [[2_000, 90]]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("does not start a child for an already aborted request", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-runtime-test-"));

  try {
    const runtime = new CodexSdkRuntime({ codexHome: home }, () => { throw new Error("must not start"); });
    const events = await collect(runtime.run({ ...request(), signal: AbortSignal.abort() }));

    assert.equal(events.length, 1);
    assert.equal(events[0].type, "result");
    assert.equal((events[0] as { reason: string }).reason, "aborted");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("configures isolated read-only execution and removes its working folder", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-runtime-test-"));
  let options: CodexOptions = {};
  let threadOptions: ThreadOptions = {};
  let message = "";
  const factory: CodexClientFactory = (config) => {
    options = config;

    return {
      startThread(settings) {
        threadOptions = settings;

        return { async runStreamed(input) { message = input; return { events: stream(success, new AbortController().signal, false, false) }; } };
      },
      resumeThread() { throw new Error("unexpected resume"); },
    };
  };

  try {
    const runtime = new CodexSdkRuntime({ codexHome: home }, factory);
    const events = await collect(runtime.run({ ...request(), capabilities: { webAccess: true } }));

    assert.equal(options.apiKey, undefined);
    assert.equal(options.env?.CODEX_HOME, home);
    assert.equal(options.env?.CODEX_API_KEY, undefined);
    assert.equal(options.env?.CODEX_APP_TOOLS_PIPE_PATH, undefined);
    assert.equal(options.env?.CODEX_PERMISSION_PROFILE, undefined);
    assert.equal(options.env?.OPENAI_API_KEY, undefined);
    assert.equal(options.config?.project_doc_max_bytes, 0);
    assert.equal(options.config?.developer_instructions, "system");
    assert.equal((options.config?.features as Record<string, unknown>).shell_tool, false);
    assert.equal(threadOptions.sandboxMode, "read-only");
    assert.equal(threadOptions.approvalPolicy, "never");
    // With approval policy never, a tool Codex would ask about is refused: the run's own tools are pre-approved.
    assert.equal(((options.config?.mcp_servers as Record<string, Record<string, unknown>>).agent).default_tools_approval_mode, "approve");
    assert.equal(threadOptions.networkAccessEnabled, false);
    assert.equal(threadOptions.webSearchMode, "live");
    assert.equal(threadOptions.modelReasoningEffort, "high");
    assert.equal(message, "hello");
    await assert.rejects(access(threadOptions.workingDirectory!));
    assert.deepEqual(events.find((event) => event.type === "usage") && { ...events.find((event) => event.type === "usage"), runId: undefined, seq: undefined, at: undefined },
      { type: "usage", model: "model-test", inputTokens: 12_069, outputTokens: 228, cacheReadTokens: 18_560, cacheWriteTokens: 12, runId: undefined, seq: undefined, at: undefined });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("resumes the mapped thread and aliases the new conversation id", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-runtime-test-"));
  let resumed = "";
  const factory: CodexClientFactory = () => ({
    startThread() { throw new Error("must resume"); },
    resumeThread(id) {
      resumed = id;

      return { async runStreamed() { return { events: stream(success, new AbortController().signal, false, false) }; } };
    },
  });

  try {
    const runtime = new CodexSdkRuntime({ codexHome: home, keepConversations: true }, factory);

    await mkdir(join(home, "sessions"), { recursive: true });
    await writeFile(join(home, "sessions", "rollout-date-thread-1.jsonl"), "");
    await runtime.conversations!.remember("previous", "thread-1");
    await collect(runtime.run({ ...request(), conversation: { id: "next", continues: "previous" } }));

    assert.equal(resumed, "thread-1");
    assert.equal(await runtime.conversations!.threadOf("next"), "thread-1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

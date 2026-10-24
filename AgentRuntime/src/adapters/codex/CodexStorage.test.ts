import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CodexConversations } from "./CodexConversations";
import { CodexSubscription } from "./CodexSubscription";
import { codexWindows } from "./codexWindows";

test("parses subscription windows defensively", () => {
  const windows = codexWindows({ primary: { used_percent: 62, resets_at: 100 }, secondary: { used_percent: 37 } });

  assert.deepEqual(windows.map((window) => [window.window, window.label, window.utilization]), [["five_hour", "5-hour", 0.62], ["weekly", "Weekly", 0.37]]);
  assert.equal(windows[0].resetsAt?.getTime(), 100_000);
  assert.equal(windows[1].resetsAt, null);
  assert.deepEqual(codexWindows({ primary: { used_percent: "62" }, secondary: { used_percent: -1 } }), []);
  assert.deepEqual(codexWindows(null), []);
});

test("reads the newest token count without making a probe request", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-storage-test-"));

  try {
    await mkdir(join(home, "sessions", "date"), { recursive: true });
    await writeFile(join(home, "sessions", "date", "rollout-date-thread.jsonl"), [
      tokenCount("2026-10-23T00:00:00Z", 20),
      "{partial",
      tokenCount("2026-10-24T00:00:00Z", 90),
    ].join("\n"));

    await mkdir(join(home, "sessions", "rollout-unreadable.jsonl"));

    const subscription = new CodexSubscription(home);
    const report = await subscription.usage();
    const event = await subscription.event("thread");

    assert.equal(report.plan, "plus");
    assert.equal(report.windows[0].utilization, 0.9);
    assert.equal(report.unavailable, null);
    assert.equal(event[0].type, "rate_limit");
    assert.equal((event[0] as { status: string }).status, "warning");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("reports usage unavailable when rollouts are missing or malformed", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-storage-test-"));

  try {
    assert.ok((await new CodexSubscription(home).usage()).unavailable);
    await mkdir(join(home, "sessions"));
    await writeFile(join(home, "sessions", "rollout-date-thread.jsonl"), "{broken\nnull\n[]");

    assert.deepEqual(await new CodexSubscription(home).event("thread"), []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("keeps aliases until the last reference is removed and replays only completed agent calls", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-storage-test-"));

  try {
    const store = new CodexConversations(home);
    const path = join(home, "sessions", "rollout-date-thread.jsonl");

    await mkdir(join(home, "sessions"));
    await writeFile(path, [
      JSON.stringify({ type: "response_item", payload: { type: "function_call", call_id: "c1", name: "mcp__agent__read_note", arguments: '{"path":"note.md"}' } }),
      JSON.stringify({ type: "response_item", payload: { type: "function_call_output", call_id: "c1", output: JSON.stringify({ content: [{ type: "text", text: "note" }] }) } }),
      JSON.stringify({ type: "response_item", payload: { type: "function_call", call_id: "unfinished", name: "mcp__agent__read_note", arguments: "{}" } }),
      JSON.stringify({ type: "response_item", payload: { type: "function_call", call_id: "foreign", name: "mcp__other__read_note", arguments: "{}" } }),
    ].join("\n"));
    await Promise.all([store.remember("first", "thread"), store.remember("second", "thread")]);

    assert.equal(await new CodexConversations(home).exists("first"), true);
    assert.deepEqual(await store.toolCalls("first"), [{ callId: "c1", name: "read_note", input: { path: "note.md" }, isError: false, output: "note" }]);

    await store.remove("first");

    assert.equal(await store.exists("first"), false);
    assert.equal(await store.exists("second"), true);

    await store.remove("second");

    await assert.rejects(access(path));
    assert.deepEqual(JSON.parse(await readFile(join(home, "powerloom-conversations.json"), "utf8")), {});
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

function tokenCount(timestamp: string, percent: number): string {
  return JSON.stringify({ timestamp, type: "event_msg", payload: { type: "token_count", rate_limits: { primary: { used_percent: percent, resets_at: 100 }, plan_type: "plus" } } });
}

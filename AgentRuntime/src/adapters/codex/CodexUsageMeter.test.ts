import assert from "node:assert/strict";
import { test } from "node:test";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexRollouts } from "./CodexRollouts";
import { CodexUsageMeter } from "./CodexUsageMeter";

function tokenCount(input: number, cached: number, output: number): string {
  return JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, total_tokens: input + output } } } });
}

async function rollout(home: string, thread: string, lines: string[]): Promise<string> {
  const path = join(home, "sessions", `rollout-date-${thread}.jsonl`);

  await mkdir(join(home, "sessions"), { recursive: true });
  await writeFile(path, lines.join("\n") + "\n");

  return path;
}

test("reports what the thread used since its last report, from the rollout's running totals", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-meter-"));

  try {
    const path = await rollout(home, "thread-1", [JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: null } }), tokenCount(1_000, 600, 50)]);
    const meter = new CodexUsageMeter(new CodexRollouts(home), "model-test");

    await meter.begin(null);

    const first = await meter.usage("thread-1");
    const nothingNew = await meter.usage("thread-1");

    await appendFile(path, tokenCount(1_500, 900, 80) + "\n");

    const second = await meter.usage("thread-1");

    assert.deepEqual(first, [{ type: "usage", model: "model-test", inputTokens: 400, outputTokens: 50, cacheReadTokens: 600, cacheWriteTokens: 0 }]);
    assert.deepEqual(nothingNew, []);
    assert.deepEqual(second, [{ type: "usage", model: "model-test", inputTokens: 200, outputTokens: 30, cacheReadTokens: 300, cacheWriteTokens: 0 }]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("doesn't count a resumed thread's earlier runs", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-meter-"));

  try {
    const path = await rollout(home, "thread-2", [tokenCount(5_000, 0, 400)]);
    const meter = new CodexUsageMeter(new CodexRollouts(home), "model-test");

    await meter.begin("thread-2");
    await appendFile(path, tokenCount(5_300, 0, 420) + "\n");

    assert.deepEqual(await meter.usage("thread-2"), [{ type: "usage", model: "model-test", inputTokens: 300, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 }]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("without a rollout the turn's own usage counts, once", async () => {
  const home = await mkdtemp(join(tmpdir(), "codex-meter-"));
  const turn = [{ type: "usage" as const, model: "model-test", inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }];

  try {
    const meter = new CodexUsageMeter(new CodexRollouts(home), "model-test");

    await meter.begin(null);

    const atEnd = await meter.atTurnEnd("thread-3", turn);

    await rollout(home, "thread-3", [tokenCount(10, 0, 2)]);

    assert.deepEqual(atEnd, turn);
    assert.deepEqual(await meter.usage("thread-3"), []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

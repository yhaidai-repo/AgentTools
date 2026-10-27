import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { Pool } from "pg";
import { createDocTools } from "../../AgentRuntime/src/tools/docTools";
import type { StoredTraceEvent } from "./models/StoredTraceEvent";
import type { UsageStore } from "./models/UsageStore";
import { PostgresUsageStore } from "./stores/PostgresUsageStore";
import { TraceRecorder } from "./TraceRecorder";

async function searchOutput(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "trace-unicode-"));
  try {
    await writeFile(join(folder, "example.md"), "a".repeat(199) + "😀 suffix");
    const search = createDocTools({ root: folder }).find((tool) => tool.name === "search_docs")!;
    const result = await search.handler({ query: "aa", dir: "" });
    assert.match(result.text, /\ud83d$/);
    return result.text;
  } finally { await rm(folder, { recursive: true, force: true }); }
}

it("repairs preexisting lone surrogates from document search while keeping valid pairs", async () => {
  const stored: StoredTraceEvent[] = [];
  const recorder = new TraceRecorder({ appendTrace: async (events) => { stored.push(...events); } } as UsageStore);
  await recorder.record({ runId: "synthetic", seq: 1, at: new Date(), type: "tool_result", output: await searchOutput(), nested: ["😀", "\ud800x\udc00", "\ud800\ud800\udc00"] });
  await recorder.flush();
  assert.match(stored[0].payload.output as string, /\uFFFD$/);
  assert.deepEqual(stored[0].payload.nested, ["😀", "�x�", "�𐀀"]);
  assert.doesNotMatch(JSON.stringify(stored), /\\u[dD][89a-fA-F][0-9a-fA-F]{2}/);
});

const databaseUrl = process.env.AGENT_USAGE_TEST_DATABASE_URL;
it("stores repaired actual search output through the PostgreSQL JSONB trace sink", { skip: !databaseUrl }, async () => {
  // Only set this variable for a disposable local test database; never use an application database.
  assert.equal(new URL(databaseUrl!).hostname, "127.0.0.1");
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresUsageStore(pool);
  const runId = `unicode-test-${randomUUID()}`;
  const dropped: unknown[] = [];
  try {
    await store.ensureSchema();
    const recorder = new TraceRecorder(store, 16384, 50, (_batch, error) => dropped.push(error));
    await recorder.record({ runId, seq: 1, at: new Date(), type: "tool_result", output: await searchOutput(), intact: "😀", low: "\udc00" });
    await recorder.flush();
    assert.deepEqual(dropped, []);
    const events = await store.trace(runId);
    assert.equal(events.length, 1);
    assert.match(events[0].payload.output as string, /�$/);
    assert.equal(events[0].payload.intact, "😀");
    assert.equal(events[0].payload.low, "�");
  } finally {
    await pool.query("DELETE FROM agent_usage.run_event WHERE run_id = $1", [runId]).finally(() => pool.end());
  }
});

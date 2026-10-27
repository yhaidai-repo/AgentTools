import assert from "node:assert/strict";
import { it } from "node:test";
import type { PowerLoomDb, localItem } from "@powerloom/db";
import type { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { buildFirstMessage } from "../generic/runGenericTask";
import { noRepos } from "../repos/openRepos";
import { commitCreatedTasks } from "./commitCreatedTasks";
import { createTaskTool } from "./createTaskTool";
import type { CreatedTask } from "./models/CreatedTask";

for (const assignee of ["docs", "user", "research", "design", "test", "custom-task"]) {
  it(`preserves ${assignee} delegation through tool, persistence and composed first message`, async () => {
    const tasks: CreatedTask[] = [];
    const tool = createTaskTool(["docs", "research", "design", "test", "custom-task"], tasks, { check: () => null, remember: () => undefined } as unknown as DuplicateGuard, new ReadLog("Synthetic input"), { depth: 0, maxDepth: 3, maxPerRun: 10, maxPerPbi: 10, createdOnPbi: 0 });
    const accepted = await tool.handler({
      assignee, kind: "task", title: "Delegated check", goal: "Inspect the synthetic record", done_when: "A checked result is saved", out_of_scope: "Do not change billing rules", effort: "trace", reason: "A decision depends on this", evidence: [{ source: "S0", ref: "Synthetic input", note: "Known facts" }], blocking: true, depends_on: ["HT-1"], options: [],
      steps: [{ action: "Read the synthetic record", source: "other", resource: "fixture", query: null, timeRange: null, reportBack: "The checked result" }], doc_path: "shop\\orders\\..\\returns.md",
    });
    assert.notEqual(accepted.isError, true);
    assert.equal(tasks[0].docPath, "shop/returns.md");
    let saved: Record<string, any> | undefined;
    const db = {
      execute: async () => ({ rows: [{ id: "WT-001" }] }),
      insert: () => ({ values: async (value: Record<string, any>) => { saved = value; } }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }) }),
    } as unknown as PowerLoomDb;
    await commitCreatedTasks(db, { pbiId: null, vault: "personal", docsVault: "personal", parentTaskId: "AT-1", runId: 7, depth: 0 }, tasks);
    assert.ok(saved);
    assert.equal(saved.data.doneWhen, "A checked result is saved");
    assert.equal(saved.data.outOfScope, "Do not change billing rules");
    assert.equal(saved.data.effort, "trace");
    assert.equal(saved.data.reason, "A decision depends on this");
    assert.deepEqual(saved.data.dependsOn, ["HT-1"]);
    if (assignee === "docs") {
      assert.equal(saved.data.project, "shop");
      assert.equal(saved.data.path, "shop/returns.md");
      assert.equal(saved.data.key, "actualize:personal:shop/returns.md:RUN-7");
    }
    if (assignee === "user") assert.match(saved.body, /Done when[\s\S]*A checked result is saved[\s\S]*Do not change billing rules/);
    const firstMessage = await buildFirstMessage(db, { ...saved, startOver: false } as typeof localItem.$inferSelect, { repos: noRepos(), toolset: null, writers: [] }, ["Synthetic writer context"], "");
    for (const expected of ["A checked result is saved", "Do not change billing rules", "Effort: trace", "A decision depends on this", "Known facts", "Depends on: HT-1", "Synthetic writer context"]) assert.ok(firstMessage.includes(expected), expected);
  });
}

it("still refuses outside and protected docs paths after normalization", async () => {
  const tasks: CreatedTask[] = [];
  const tool = createTaskTool(["docs"], tasks, { check: () => null, remember: () => undefined } as unknown as DuplicateGuard, new ReadLog("Synthetic input"), { depth: 0, maxDepth: 3, maxPerRun: 10, maxPerPbi: 10, createdOnPbi: 0 });
  for (const doc_path of ["../outside/note.md", "shop/../draft/note.md", "/outside/note.md"]) {
    const result = await tool.handler({ assignee: "docs", kind: "task", title: "Check", goal: "Check", done_when: "Done", out_of_scope: null, effort: "trace", reason: "Needed", evidence: [], blocking: false, depends_on: [], options: [], steps: [], doc_path });
    assert.equal(result.isError, true);
  }
  assert.equal(tasks.length, 0);
});

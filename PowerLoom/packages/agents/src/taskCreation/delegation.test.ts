import assert from "node:assert/strict";
import { it } from "node:test";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import type { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { buildFirstMessage } from "../generic/runGenericTask";
import { noRepos } from "../repos/openRepos";
import { commitCreatedTasks } from "./commitCreatedTasks";
import { createHandOffTool } from "../handoff/handOffTool";
import { createTaskTool } from "./createTaskTool";
import type { CreatedTask } from "./models/CreatedTask";

const CAN_ASSIGN = ["docs", "research", "design", "test", "custom-task"];
const LIMITS = { depth: 0, maxDepth: 3, maxPerRun: 10, maxPerPbi: 10, createdOnPbi: 0 };
const noDuplicates = { check: () => null, remember: () => undefined } as unknown as DuplicateGuard;

// create_task for the task types; the user is reached through hand_off, with the same fields and a package.
function delegationTool(assignee: string, tasks: CreatedTask[]) {
  const tool = assignee === "user" ? createHandOffTool(CAN_ASSIGN, tasks, noDuplicates, new ReadLog("Synthetic input"), LIMITS) : createTaskTool(CAN_ASSIGN, tasks, noDuplicates, new ReadLog("Synthetic input"), LIMITS);
  const handOff = { to: "person", item: "task", intent: "ask", gate: "none", package: { body: "Inspect the synthetic record", results: [], items: [], notes: [] } };

  return { handler: (input: Record<string, unknown>) => tool.handler(assignee === "user" ? { ...input, ...handOff } : input) };
}

for (const assignee of ["docs", "user", "research", "design", "test", "custom-task"]) {
  it(`preserves ${assignee} delegation through tool, persistence and composed first message`, async () => {
    const tasks: CreatedTask[] = [];
    const tool = delegationTool(assignee, tasks);
    const accepted = await tool.handler({
      assignee, kind: "task", title: "Delegated check", goal: "Inspect the synthetic record", done_when: "A checked result is saved", out_of_scope: "Do not change billing rules", effort: "trace", reason: "A decision depends on this", evidence: [{ source: "S0", ref: "Synthetic input", note: "Known facts" }], blocking: true, depends_on: ["HT-1"], options: [],
      steps: [{ action: "Read the synthetic record", source: "other", resource: "fixture", query: null, timeRange: null, reportBack: "The checked result" }], doc_path: "shop\\orders\\..\\returns.md",
    });
    assert.notEqual(accepted.isError, true);
    assert.equal(tasks[0].docPath, "shop/returns.md");
    let saved: Record<string, any> | undefined;
    const db = {
      execute: async () => ({ rows: [{ id: "WT-001" }] }),
      insert: (table: unknown) => ({ values: async (value: Record<string, any>) => { if (table === localItem) saved = value; } }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }), innerJoin: () => ({ where: () => ({ orderBy: async () => [] }) }) }) }),
    } as unknown as PowerLoomDb;
    await commitCreatedTasks(db, { pbiId: null, vault: "personal", docsVault: "personal", parentTaskId: "AT-1", agent: "synthetic", runId: 7, depth: 0 }, tasks);
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
  const tool = createTaskTool(["docs"], tasks, noDuplicates, new ReadLog("Synthetic input"), LIMITS);
  for (const doc_path of ["../outside/note.md", "shop/../draft/note.md", "/outside/note.md"]) {
    const result = await tool.handler({ assignee: "docs", kind: "task", title: "Check", goal: "Check", done_when: "Done", out_of_scope: null, effort: "trace", reason: "Needed", evidence: [], blocking: false, depends_on: [], options: [], steps: [], doc_path });
    assert.equal(result.isError, true);
  }
  assert.equal(tasks.length, 0);
});

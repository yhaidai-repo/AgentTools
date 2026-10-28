import assert from "node:assert/strict";
import { it } from "node:test";
import { z } from "zod";
import { CREATABLE_TASK_TYPES } from "@powerloom/core";
import { handoff, localItem, type PowerLoomDb, type workItem } from "@powerloom/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { AGENT_DEFAULTS } from "../agentDefaults";
import { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { decideSettlement } from "../generic/settleTask";
import { createHandOffTool } from "../handoff/handOffTool";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { commitTestReport } from "./commitTestReport";
import type { TestReport } from "./models/TestReport";

// Autotest's missing test data goes to refinement through hand_off v1 (intent ask): the test waits and runs again.
function refinementHandOff(goal: string) {
  return {
    to: "refinement", item: "task", intent: "ask", gate: "none", title: "Find the data for AC 1",
    package: { body: "AC 1 needs a request with an XB response; the permitted search found none.", results: [], items: [], notes: [] },
    goal,
    done_when: "The refinement records a usable request id and the evidence that it has an XB response.",
    effort: "lookup", reason: "The planned API case cannot run without this record.",
    evidence: [{ source: "S0", ref: "PBI 7", note: "AC 1 requires the XB response" }],
    blocking: true,
  };
}

it("hands missing test data to refinement and holds the test with its local cases preserved", async () => {
  const agent = AGENT_DEFAULTS.find((definition) => definition.id === "autotest")!;
  const tasks: CreatedTask[] = [];
  const tool = createHandOffTool(agent.canAssign, tasks, { check: () => null, remember: () => undefined } as unknown as DuplicateGuard, new ReadLog("PBI 7: prove AC 1"), { depth: 1, maxDepth: 3, maxPerRun: 8, maxPerPbi: 20, createdOnPbi: 0 });
  const input = z.object(tool.input).parse(refinementHandOff("AC 1 needs a request with an XB response; the permitted search found none."));
  assert.ok(CREATABLE_TASK_TYPES.includes("refinement"));
  assert.notEqual((await tool.handler(input)).isError, true);

  const saved: (typeof localItem.$inferInsert)[] = [];
  const handoffs: (typeof handoff.$inferInsert)[] = [];
  const stems: unknown[] = [];
  const db = {
    execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const stem = new PgDialect().sqlToQuery(query).params[0];
      stems.push(stem);
      return { rows: [{ id: `${stem}001` }] };
    },
    insert: (table: unknown) => ({ values: async (value: never) => { (table === handoff ? handoffs : saved).push(value); } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  } as unknown as PowerLoomDb;
  const taskIds = await commitCreatedTasks(db, { pbiId: 7, vault: "personal", docsVault: "personal", parentTaskId: "TT-7-001", agent: "autotest", runId: 1, depth: 1 }, tasks);
  assert.deepEqual(taskIds, ["RT-7-001"]);
  assert.equal(saved[0].kind, "refinement");
  assert.equal(saved[0].assignee, "agent:*");
  assert.equal(saved[0].pbiId, 7);
  assert.equal(saved[0].parentId, "TT-7-001");
  assert.equal((saved[0].data as Record<string, unknown>).doneWhen, input.done_when);
  assert.deepEqual(handoffs.map((row) => [row.fromTaskId, row.fromAgent, row.toKind, row.toItemId, row.intent, row.gate]), [["TT-7-001", "autotest", "agent", "RT-7-001", "ask", "none"]]);

  const report: TestReport = {
    goal: "Prove AC 1", status: "blocked", summary: "The local API case waits for new:1.",
    analysis: [{ kind: "missing_test_data", about: "AC 1", detail: "No XB response data", evidence: [], resolution: "new:1" }],
    cases: [{ ref: "agent", title: "API returns XB", criterion: "AC 1", steps: ["GET the request"], data: "Missing; new:1", expected: "An XB response", state: "blocked", blockedBy: "new:1" }],
    services: [], results: [], adoEdits: [], nextReason: "Wait for refinement.",
  };
  const committed = await commitTestReport({ db, powerloomUrl: "http://unused" }, { id: "TT-7-001", title: "Test AC 1" } as typeof localItem.$inferSelect, { adoId: 7 } as typeof workItem.$inferSelect, 1, { report, bugs: [] }, { tasks, taskIds }, { commits: {}, docsRead: [], docsVault: "personal" });
  assert.deepEqual(stems, ["RT-7-", "TR-7-"]);
  const storedReport = (saved[1].data as { report: TestReport }).report;
  assert.equal(storedReport.cases[0].ref, "agent");
  assert.equal(storedReport.cases[0].blockedBy, "RT-7-001");
  assert.equal(storedReport.analysis[0].resolution, "RT-7-001");
  assert.deepEqual(storedReport.results, []);
  assert.deepEqual(committed.blocking, ["RT-7-001"]);
  assert.deepEqual(decideSettlement({ outcome: "success", result: { status: "blocked", body: "Wait for the XB data", data: null, evidence: [], waitingFor: [] }, handoffs: [{ intent: "ask", toItemId: "RT-7-001" }], openWaitingFor: [], writers: [{ kind: "waits", ids: committed.blocking, reason: "Missing test data" }] }), { kind: "wait", ids: ["RT-7-001"], reason: "Missing test data" });
});

for (const status of ["open", "cancelled"] as const) {
  it(`refuses duplicate handoffs when an existing refinement is ${status}`, async () => {
    const goal = "Find a permitted request with an XB response for AC 1";
    const db = {
      select: () => ({ from: () => ({ where: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        const parameters = new PgDialect().sqlToQuery(query).params;
        return parameters.includes("refinement") ? [{ id: "RT-7-001", kind: "refinement", status, body: goal, title: "Find test data" }] : [];
      } }) }),
    } as unknown as PowerLoomDb;
    const tasks: CreatedTask[] = [];
    const guard = await DuplicateGuard.load(db, 7);
    const tool = createHandOffTool(["refinement"], tasks, guard, new ReadLog("PBI 7"), { depth: 1, maxDepth: 3, maxPerRun: 8, maxPerPbi: 20, createdOnPbi: 1 });
    const input = z.object(tool.input).parse(refinementHandOff(goal));

    const result = await tool.handler(input);

    assert.equal(result.isError, true);
    assert.match(result.text, new RegExp(`repeats RT-7-001 \\(${status}\\)`));
    assert.deepEqual(tasks, []);
  });
}

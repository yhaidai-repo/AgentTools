import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { joinAskedToReceivers } from "./askedDependencies";

function created(assignee: string, intent: "continue" | "ask" | "review" | "return" | null): CreatedTask {
  const handoff = intent ? { intent, gate: "none" as const, package: { body: "x", refs: { results: [], items: [], notes: [] } } } : null;

  return { assignee, kind: assignee === "user" ? "question" : "task", title: "t", goal: "g", doneWhen: "d", outOfScope: null, effort: "lookup", reason: "r", evidence: [], blocking: true, dependsOn: [], options: [], steps: [], docPath: null, handoff };
}

// Records each update: the table, the receivers and the ids the dependsOn union adds.
function updatesDb() {
  const dialect = new PgDialect();
  const updates: { table: unknown; added: string[]; receivers: unknown[] }[] = [];
  const db = {
    update: (table: unknown) => ({ set: (changes: { data: never }) => ({ where: async (predicate: never) => {
      const added = dialect.sqlToQuery(changes.data).params.find((param) => typeof param === "string" && param.startsWith("[")) as string;
      updates.push({ table, added: JSON.parse(added), receivers: dialect.sqlToQuery(predicate).params });
    } }) }),
  } as unknown as PowerLoomDb;

  return { db, updates };
}

describe("joinAskedToReceivers", () => {
  it("makes the agent tasks that carry the work on wait for what the run asked", async () => {
    const { db, updates } = updatesDb();
    const tasks = [created("implement", "continue"), created("user", "ask"), created("research", "ask"), created("planning", "return"), created("user", "review"), created("research", null)];

    await joinAskedToReceivers(db, tasks, ["XT-1-001", "Q-1-002", "AT-1-003", "XT-1-004", "HT-1-005", "AT-1-006"]);

    assert.equal(updates.length, 1);
    assert.equal(updates[0].table, localItem);
    assert.deepEqual(updates[0].added, ["Q-1-002", "AT-1-003"]);
    assert.deepEqual(updates[0].receivers, ["XT-1-001", "XT-1-004"]);
  });

  it("changes nothing without both an ask and an agent that carries the work on", async () => {
    const { db, updates } = updatesDb();

    await joinAskedToReceivers(db, [created("user", "ask"), created("user", "review")], ["Q-1-001", "HT-1-002"]);
    await joinAskedToReceivers(db, [created("implement", "continue"), created("research", null)], ["XT-1-001", "AT-1-002"]);

    assert.deepEqual(updates, []);
  });
});

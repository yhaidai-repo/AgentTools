import assert from "node:assert/strict";
import { it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { agentRun, planningSnapshot, reviewComment, codeReview, codeReviewVersion, localItem, vaultCapture, runResult, pbiEstimate, type PowerLoomDb } from "@powerloom/db";
import { AgentToolset } from "./AgentToolset";
import { commitPlan } from "../planning/commitPlan";
import { commitReview } from "../codeReview/commitReview";
import { DuplicateGuard } from "../DuplicateGuard";
import type { RunWriter } from "./models/RunWriter";

it("retains actual plan/review writer outputs together with tasks, captures, results and estimates", async () => {
  let outputs = ["earlier recording"];
  const inserted: { table: unknown; values: any }[] = [];
  const dialect = new PgDialect();
  const journal = new Map<string, unknown>();
  let failReview = true;
  const fake = {
    transaction: async (action: (tx: unknown) => Promise<unknown>) => {
      const before = { outputs: [...outputs], inserted: inserted.length, journal: new Map(journal) };
      try { return await action(fake); }
      catch (error) { outputs = before.outputs; inserted.length = before.inserted; journal.clear(); for (const entry of before.journal) journal.set(...entry); throw error; }
    },
    select: () => ({ from: (table: unknown) => ({ where: () => {
      const result = { then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(table === agentRun ? [{ outputs: [...outputs] }] : []).then(resolve), for: async () => table === codeReview ? [{ id: 7 }] : [], orderBy: () => ({ limit: async () => [] }) };
      return result;
    } }) }),
    insert: (table: unknown) => ({ values: (values: any) => {
      if (table === codeReviewVersion && failReview) throw new Error("synthetic review commit failure");
      inserted.push({ table, values });
      return { returning: async () => [{ id: 1 }], onConflictDoNothing: async () => undefined };
    } }),
    update: (table: unknown) => ({ set: (changes: any) => ({ where: async () => {
      if (table === agentRun && changes.outputs) outputs = [...new Set([...outputs, ...JSON.parse(dialect.sqlToQuery(changes.outputs).params[0] as string)])];
    } }) }),
    execute: async (statement: any) => {
      const query = dialect.sqlToQuery(statement);
      if (query.sql.includes("select result from agent_commit_step")) return { rows: journal.has(String(query.params[1])) ? [{ result: journal.get(String(query.params[1])) }] : [] };
      if (query.sql.includes("insert into agent_commit_step")) journal.set(String(query.params[1]), JSON.parse(query.params[2] as string));
      return { rows: [{ id: "HT-7-001" }] };
    },
  };
  const db = fake as unknown as PowerLoomDb;
  const task = { id: "AT-7-001", pbiId: 7, vault: "demo", data: {}, title: "Synthetic" } as any;
  const context = { deps: { db, docsVaultName: "demo" }, agent: { id: "synthetic", label: "Synthetic", budgets: {}, capabilities: { integrations: {} } } } as any;
  const writers: RunWriter[] = [
    { integration: "writePlan", tools: () => [], commit: async target => {
      await commitPlan(db, 7, target.runId, { content: { summary: "Synthetic", decisions: [], autoChoices: [], requirements: [], plans: [], checker: { verdict: "passed", issues: [] }, risks: [], assumptions: [] }, inspect: { schema_version: 1 } }, null);
      return [];
    } },
    { integration: "reviewCode", tools: () => [], commit: async target => {
      await commitReview(db, { checkout: { sourceCommit: "head" }, context: { pr: { id: 7, sourceCommit: "head", iteration: 1, origin: "github" } }, outdatedIds: [], draft: { summary: "Synthetic", updates: [], comments: [{ path: "demo.ts", startLine: 1, endLine: 1, severity: "minor", body: "Synthetic" }] } } as any, target.runId);
      return [];
    } },
  ];
  // Exercise commit on the actual shared toolset without unrelated opening/read integrations.
  const toolset = Reflect.construct(AgentToolset, [context, { runId: 1 }, task, { repos: { repos: [] }, writers }, null, DuplicateGuard.none(), { depth: 1 }]) as AgentToolset;
  toolset.tasks.push({ assignee: "user", kind: "human", title: "Synthetic", goal: "Synthetic", reason: "Synthetic", doneWhen: "Done", outOfScope: "", steps: [], evidence: [], dependsOn: [], blocking: true } as any);
  toolset.captures.push({ name: "demo-synthetic", project: "demo", title: "Synthetic", target: "demo", captured: ["Synthetic"], assumptions: [], toFill: [] });
  toolset.result.record({ status: "complete", body: "Synthetic", data: null, evidence: [], waitingFor: [] });
  toolset.estimate.record({ humanHours: 2, agentHours: 1, complexity: 1, confidence: "high", basis: "Synthetic" });
  await assert.rejects(toolset.commit(1), /review commit failure/);
  assert.ok(outputs.includes("plan v1"));
  assert.ok(!outputs.includes("RC-7-001"));
  failReview = false;
  await toolset.commit(1);
  assert.deepEqual(outputs, ["earlier recording", "HT-7-001", "CAP-1", "plan v1", "RC-7-001", "result: complete", "PBI-7 estimate"]);
  for (const table of [planningSnapshot, reviewComment, codeReviewVersion, localItem, vaultCapture, runResult, pbiEstimate]) assert.ok(inserted.some(entry => entry.table === table));
  for (const table of [planningSnapshot, reviewComment, localItem, vaultCapture, runResult, pbiEstimate]) assert.equal(inserted.filter(entry => entry.table === table).length, 1);
});

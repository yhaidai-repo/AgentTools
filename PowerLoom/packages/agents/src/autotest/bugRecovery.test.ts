import assert from "node:assert/strict";
import { it, mock } from "node:test";
import type { PowerLoomDb } from "@powerloom/db";
import { commitBugs } from "./commitBugs";
import { commitTestReport } from "./commitTestReport";
import type { BugDraft } from "./models/BugDraft";

const bugs: BugDraft[] = ["one", "two"].map(title => ({ title, criterion: "Synthetic", case: "Synthetic", steps: ["Synthetic"], expected: "Synthetic", actual: "Synthetic", evidence: [], artifacts: [], suspectedCause: null, priority: 2 }));

it("reuses per-draft request identities after a later failure, response loss and report insert failure", async () => {
  const stored = new Map<string, number>();
  let failSecond = true;
  let loseResponse = true;
  const fetcher = (async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    if (body.title === "two" && failSecond) throw new Error("synthetic second request failure");
    if (!stored.has(body.clientRequestId)) stored.set(body.clientRequestId, 40001 + stored.size);
    if (body.title === "one" && loseResponse) { loseResponse = false; throw new Error("synthetic response lost"); }
    return new Response(JSON.stringify({ adoId: stored.get(body.clientRequestId) }));
  }) as typeof fetch;
  await assert.rejects(commitBugs("http://synthetic", 7, bugs, "TT-7", fetcher), /response lost/);
  await assert.rejects(commitBugs("http://synthetic", 7, bugs, "TT-7", fetcher), /second request/);
  assert.equal(stored.size, 1);
  failSecond = false;
  const globalFetch = mock.method(globalThis, "fetch", fetcher);
  let reportFails = true;
  let data: any;
  const db = {
    execute: async () => ({ rows: [{ id: "TR-7-001" }] }),
    insert: () => ({ values: async (value: any) => { if (reportFails) throw new Error("synthetic report failure"); data = value.data; } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  } as unknown as PowerLoomDb;
  const report = { goal: "Synthetic", status: "complete", summary: "See bug:1 and bug:2", analysis: [], cases: [], services: [], results: [], adoEdits: [], nextReason: "Synthetic" } as any;
  const commit = () => commitTestReport({ db, powerloomUrl: "http://synthetic" }, { id: "TT-7", title: "Synthetic" } as any, { adoId: 7 } as any, 1, { report, bugs }, { tasks: [], taskIds: [] }, { commits: {}, docsRead: [], docsVault: "demo" });
  try {
    await assert.rejects(commit(), /report failure/);
    assert.equal(stored.size, 2);
    reportFails = false;
    await commit();
    assert.equal(stored.size, 2);
    assert.deepEqual(data.bugIds, ["PBI-40001", "PBI-40002"]);
    assert.match(data.report.summary, /PBI-40001.*PBI-40002/);
  } finally { globalFetch.mock.restore(); }
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pbiEstimate, planningSnapshot, type PowerLoomDb } from "@powerloom/db";
import { latestPbiVersion } from "./resultVersions";

type Row = { id: number; version?: number; runId: number | null; agent: string | null; at: Date };

// Answers the version listing of one table with the given rows (oldest first, as the listings order them); any other
// table has none. A listing joins the run for its agent, except the estimates, which store theirs.
function dbWith(table: unknown, rows: Row[]): PowerLoomDb {
  const listing = (from: unknown) => ({ orderBy: async () => (from === table ? rows : []) });
  const query = (from: unknown) => ({ leftJoin: () => ({ where: () => listing(from) }), where: () => listing(from) });

  return { select: () => ({ from: query }) } as unknown as PowerLoomDb;
}

describe("latestPbiVersion", () => {
  it("is the newest version of that kind, as the kind's listing orders them", async () => {
    const rows: Row[] = [
      { id: 10, version: 1, runId: 40, agent: "planning", at: new Date("2026-10-28T10:00:00Z") },
      { id: 12, version: 2, runId: 41, agent: "planning", at: new Date("2026-10-29T10:00:00Z") },
    ];

    const latest = await latestPbiVersion(dbWith(planningSnapshot, rows), "plan", 7);

    assert.deepEqual(latest, { kind: "plan", id: "12", label: "v2", runId: 41, agent: "planning", at: rows[1].at, status: null });
  });

  it("counts estimates in the order they were recorded", async () => {
    const rows: Row[] = [
      { id: 3, runId: 40, agent: "estimator", at: new Date("2026-10-28T10:00:00Z") },
      { id: 5, runId: null, agent: "refiner", at: new Date("2026-10-29T10:00:00Z") },
    ];

    const latest = await latestPbiVersion(dbWith(pbiEstimate, rows), "estimate", 7);

    assert.equal(latest?.id, "5");
    assert.equal(latest?.label, "v2");
  });

  it("is null when the PBI has no version of that kind", async () => {
    assert.equal(await latestPbiVersion(dbWith(planningSnapshot, []), "build", 7), null);
  });
});

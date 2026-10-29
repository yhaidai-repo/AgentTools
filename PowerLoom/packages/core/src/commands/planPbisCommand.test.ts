import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import { planPbisCommand } from "./planPbisCommand";

describe("pbi.plan", () => {
  it("queues the planning tasks and names the PBIs it passed over", async () => {
    const asked: number[][] = [];
    const powerloom = { planPbis: async (adoIds: number[]) => (asked.push(adoIds), { ok: true, value: { queued: [1], unknown: [3], closed: [2] } }) };
    const context = { powerloom } as unknown as CommandContext;

    const planned = await planPbisCommand.run(context, { adoIds: [1, 2, 3] });

    assert.deepEqual(asked, [[1, 2, 3]]);
    assert.deepEqual(planned, { ok: true, value: { queued: [1], skipped: ["PBI-2 is closed: reopen it first.", "PBI-3 isn't in PowerLoom."], message: "1 PBI(s) queued: notes written and a planning task each." } });
  });
});

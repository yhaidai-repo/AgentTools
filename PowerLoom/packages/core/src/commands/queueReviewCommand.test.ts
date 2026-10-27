import assert from "node:assert/strict";
import { it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import { queueReviewCommand } from "./queueReviewCommand";

for (const outcomes of [[], [false], [true], [true, false]]) {
  it(`S3-05 reports actual review dispatch outcomes: ${JSON.stringify(outcomes)}`, async () => {
    const calls: string[] = [];
    const context = {
      agents: { list: async () => outcomes.map((_, i) => ({ id: `reviewer-${i}`, enabled: true, handles: ["review"] })) },
      powerloom: {
        queueReview: async () => ({ ok: true, value: "CR-17-001" }),
        runAgent: async (id: string) => { calls.push(id); return outcomes[Number(id.split("-")[1])] ? { ok: true, value: {} } : { ok: false, error: "Agents are paused" }; },
      },
    } as unknown as CommandContext;
    const result = await queueReviewCommand.run(context, { prId: 17 });
    assert.ok(result.ok);
    assert.match(result.value.message, /CR-17-001 queued/);
    assert.doesNotMatch(result.value.message, /it starts now/);
    if (outcomes.includes(false)) assert.match(result.value.message, /Agents are paused/);
    if (outcomes.includes(true)) assert.match(result.value.message, /1 agent dispatch\(es\) accepted/);
    else assert.match(result.value.message, /no (enabled agent|agent dispatch)/);
    assert.equal(calls.length, outcomes.length);
  });
}

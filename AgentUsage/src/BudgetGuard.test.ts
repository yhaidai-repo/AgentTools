import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BudgetGuard } from "./BudgetGuard";
import { BudgetReservations } from "./BudgetReservations";
import type { BudgetPolicy } from "./models/BudgetPolicy";
import type { UsageLabels } from "./models/UsageLabels";
import type { UsageStore } from "./models/UsageStore";

// A store whose cost read takes a moment, as Postgres does: the window two unguarded starts race through.
function storeSpending(spent: Record<string, number>, delayMs = 5): UsageStore {
  const costSince = async (_from: Date, match: UsageLabels) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return match.agent ? spent[String(match.agent)] ?? 0 : Object.values(spent).reduce((sum, cost) => sum + cost, 0);
  };

  return { costSince } as unknown as UsageStore;
}

const POLICY: BudgetPolicy = { perRunUsd: 5, daily: [{ match: { agent: "coder" }, limitUsd: 10 }, { match: {}, limitUsd: 20 }] };

describe("BudgetGuard.canStart", () => {
  it("allows a start while the day's spend is under every applicable budget", async () => {
    const guard = new BudgetGuard(POLICY, storeSpending({ coder: 9.5 }), new BudgetReservations());

    assert.deepEqual(await guard.canStart({ agent: "coder" }), { allowed: true, reason: null });
  });

  it("refuses once the agent's or the global budget is reached", async () => {
    const agent = new BudgetGuard(POLICY, storeSpending({ coder: 10 }), new BudgetReservations());
    const global = new BudgetGuard(POLICY, storeSpending({ coder: 4, other: 16 }), new BudgetReservations());

    assert.match((await agent.canStart({ agent: "coder" })).reason ?? "", /\{"agent":"coder"\}: \$10.0000 of \$10.00/);
    assert.match((await global.canStart({ agent: "coder" })).reason ?? "", /all runs: \$20.0000 of \$20.00/);
  });
});

describe("BudgetGuard.reserve", () => {
  it("lets concurrent starts through only while what is spent and reserved stays under the daily budget", async () => {
    const ledger = new BudgetReservations();
    const guard = new BudgetGuard(POLICY, storeSpending({ coder: 2 }), ledger);

    // 2 spent, each run reserves 5: the first sees 2, the second 7, the third 12 and is refused.
    const starts = await Promise.all([1, 2, 3].map(() => guard.reserve({ agent: "coder" }, 5)));

    assert.deepEqual(starts.map((start) => start.allowed), [true, true, false]);
    assert.match(starts[2].reason ?? "", /\$2.0000 plus \$10.0000 reserved by runs in progress of \$10.00/);
    assert.equal(ledger.count, 2);
  });

  it("frees the share when a run settles, so the next start fits again", async () => {
    const ledger = new BudgetReservations();
    const guard = new BudgetGuard(POLICY, storeSpending({ coder: 6 }), ledger);
    const first = await guard.reserve({ agent: "coder" }, 5);
    const refused = await guard.reserve({ agent: "coder" }, 5);

    first.reservation?.release();

    const again = await guard.reserve({ agent: "coder" }, 5);

    assert.equal(refused.allowed, false);
    assert.equal(again.allowed, true);
    assert.equal(ledger.count, 1);
  });

  it("counts a reservation only against the budgets its labels match", async () => {
    const ledger = new BudgetReservations();
    const guard = new BudgetGuard(POLICY, storeSpending({ coder: 0, writer: 0 }), ledger);

    await guard.reserve({ agent: "writer" }, 9);
    await guard.reserve({ agent: "writer" }, 9);

    const coder = await guard.reserve({ agent: "coder" }, 5);
    const writer = await guard.reserve({ agent: "writer" }, 5);

    assert.equal(coder.allowed, true, "the writers' 18 reserved stay under the global 20 and don't touch the coder's budget");
    assert.equal(writer.allowed, false);
    assert.match(writer.reason ?? "", /all runs: \$0.0000 plus \$23.0000 reserved/);
  });

  it("keeps deciding after a store failure", async () => {
    const ledger = new BudgetReservations();
    let fail = true;
    const store = { costSince: async () => { if (fail) throw new Error("down"); return 0; } } as unknown as UsageStore;
    const guard = new BudgetGuard(POLICY, store, ledger);

    await assert.rejects(guard.reserve({ agent: "coder" }, 5), /down/);
    fail = false;
    assert.equal((await guard.reserve({ agent: "coder" }, 5)).allowed, true);
  });
});

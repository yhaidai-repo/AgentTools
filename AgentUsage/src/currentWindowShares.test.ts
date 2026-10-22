import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentWindowShares } from "./currentWindowShares";
import type { SubscriptionUsage } from "./models/SubscriptionUsage";
import type { UsageRecord } from "./models/UsageRecord";

const OLD_RESET = "2026-10-22T06:00:00.000Z";
const RESET = "2026-10-22T11:00:00.000Z";
const WEEK_RESET = "2026-10-27T22:00:00.000Z";

function window(name: string, label: string, resetsAt: string, start: number, end: number): SubscriptionUsage {
  return { provider: "anthropic", window: name, label, resetsAt, startUtilization: start, endUtilization: end };
}

// Only the fields the shares read.
function run(runId: string, agent: string, startHour: number, costUsd: number, subscription: SubscriptionUsage[]): UsageRecord {
  const startedAt = new Date(Date.UTC(2026, 9, 22, startHour));

  return { runId, labels: { agent }, startedAt, endedAt: new Date(startedAt.getTime() + 30 * 60 * 1000), costUsd, subscription } as unknown as UsageRecord;
}

function near(actual: number | undefined, expected: number): void {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
}

describe("currentWindowShares", () => {
  // Newest first, as the store returns them. The 5-hour period that resets at RESET went from 10% to 18%: autotest
  // spent $3 of the $4, so it used 6% and design 2%. Autotest's run before the reset counts for nothing now.
  const records = [
    run("3", "design", 9, 1, [window("five_hour", "5-hour", RESET, 0.14, 0.18), window("seven_day", "Weekly", WEEK_RESET, 0.3, 0.32)]),
    run("2", "autotest", 8, 3, [window("five_hour", "5-hour", RESET, 0.1, 0.14), window("seven_day", "Weekly", WEEK_RESET, 0.28, 0.3)]),
    run("1", "autotest", 4, 5, [window("five_hour", "5-hour", OLD_RESET, 0.5, 0.9), window("seven_day", "Weekly", WEEK_RESET, 0.2, 0.28)]),
  ];

  it("adds up each agent's runs in the current period of each window, and starts again after a reset", () => {
    const shares = currentWindowShares(records, "agent");
    const autotest = shares.get("autotest")!;
    const design = shares.get("design")!;

    assert.deepEqual(autotest.map((share) => share.label), ["5-hour", "Weekly"]);
    near(autotest[0].share, 0.06);
    near(design[0].share, 0.02);
    near(autotest[1].share, 0.12 * (8 / 9));
    near(design[1].share, 0.12 * (1 / 9));
    assert.equal(autotest[0].resetsAt, RESET);
  });

  // Research ran only before the 5-hour reset, still in this week; "old" only in the old 5-hour period. The week went from
  // 19% to 32% over $10, research's $1 of it.
  it("lists every current window for an agent, 0 for one it didn't use, and leaves out an agent with no current run", () => {
    const older = [
      ...records,
      run("0", "research", 3, 1, [window("five_hour", "5-hour", OLD_RESET, 0.4, 0.5), window("seven_day", "Weekly", WEEK_RESET, 0.19, 0.2)]),
      run("-1", "old", 2, 1, [window("five_hour", "5-hour", OLD_RESET, 0.3, 0.4)]),
    ];

    const shares = currentWindowShares(older, "agent");
    const research = shares.get("research")!;

    assert.deepEqual(research.map((share) => share.label), ["5-hour", "Weekly"]);
    near(research[0].share, 0);
    near(research[1].share, 0.13 * (1 / 10));
    assert.equal(shares.has("old"), false);
    assert.equal(currentWindowShares([], "agent").size, 0);
  });
});

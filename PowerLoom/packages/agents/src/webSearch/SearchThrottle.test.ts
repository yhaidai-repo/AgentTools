import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ThrottleClock } from "./models/ThrottleClock";
import type { WebSearchAnswer } from "./models/WebSearchAnswer";
import { SearchThrottle } from "./SearchThrottle";

const PACE = { minSecondsBetweenSearches: 5, cacheHours: 24 };
const ANSWER: WebSearchAnswer = { hits: [{ title: "t", url: "https://a.example", snippet: "" }], unresponsiveEngines: [] };

function fakeClock(): ThrottleClock & { waits: number[]; advance: (ms: number) => void } {
  let now = 1_000_000;
  const waits: number[] = [];

  return {
    waits,
    now: () => now,
    sleep: async (ms) => {
      waits.push(ms);
      now += ms;
    },
    advance: (ms) => {
      now += ms;
    },
  };
}

function request(query: string) {
  return { query, language: "uk-UA", freshness: null };
}

describe("SearchThrottle", () => {
  it("keeps the gap between two searches and starts the first at once", async () => {
    const clock = fakeClock();
    const throttle = new SearchThrottle(clock);

    await throttle.search(request("first"), PACE, async () => ANSWER);
    clock.advance(2_000);
    await throttle.search(request("second"), PACE, async () => ANSWER);

    assert.deepEqual(clock.waits, [0, 3_000]);
  });

  it("runs one search at a time", async () => {
    const throttle = new SearchThrottle(fakeClock());
    const order: string[] = [];
    const slow = (name: string) => async () => {
      order.push(`start ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end ${name}`);

      return ANSWER;
    };

    await Promise.all([throttle.search(request("a"), PACE, slow("a")), throttle.search(request("b"), PACE, slow("b"))]);

    assert.deepEqual(order, ["start a", "end a", "start b", "end b"]);
  });

  it("answers the same search from the cache until it is older than the cache hours", async () => {
    const clock = fakeClock();
    const throttle = new SearchThrottle(clock);
    let searches = 0;
    const run = async () => {
      searches++;

      return ANSWER;
    };

    await throttle.search(request("HETS 270"), PACE, run);
    await throttle.search(request(" hets 270 "), PACE, run);
    clock.advance(25 * 3_600_000);
    await throttle.search(request("HETS 270"), PACE, run);

    assert.equal(searches, 2);
  });

  it("doesn't keep an answer some engines didn't respond to", async () => {
    const throttle = new SearchThrottle(fakeClock());
    let searches = 0;
    const partial = async () => {
      searches++;

      return { ...ANSWER, unresponsiveEngines: [{ engine: "google", reason: "CAPTCHA" }] };
    };

    await throttle.search(request("hets"), PACE, partial);
    await throttle.search(request("hets"), PACE, partial);

    assert.equal(searches, 2);
  });

  it("goes on with the next search after one failed", async () => {
    const throttle = new SearchThrottle(fakeClock());

    await assert.rejects(throttle.search(request("a"), PACE, async () => {
      throw new Error("down");
    }));

    assert.deepEqual(await throttle.search(request("b"), PACE, async () => ANSWER), ANSWER);
  });
});

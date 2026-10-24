import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PriceBook } from "./PriceBook";

const MILLION = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 };

describe("Codex models' budget prices", () => {
  it("are priced from 2026-10-24 at the nominal API-equivalent rates", () => {
    const book = new PriceBook();

    assert.deepEqual(book.cost("gpt-6.1-sol", MILLION, new Date("2026-10-25")), { costUsd: 2 + 10 + 0.1 + 2.5, isPriced: true });
    assert.deepEqual(book.cost("gpt-6-astra", MILLION, new Date("2026-10-25")), { costUsd: 10 + 50 + 1 + 12.5, isPriced: true });
  });

  it("aren't known before that date, so the fallback price guards the budget", () => {
    assert.equal(new PriceBook().cost("gpt-6.1-sol", MILLION, new Date("2026-10-23")).isPriced, false);
  });
});

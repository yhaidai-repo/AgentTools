import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PriceBook } from "./PriceBook";

const MILLION = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 };

describe("Codex models' budget prices", () => {
  it("uses explicit overrides on identical effective dates for base and dated aliases", () => {
    const book = new PriceBook([{ model: "gpt-6.1-sol-20261024", from: "2026-10-24", inputPerMTok: 99, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 }]);
    for (const model of ["gpt-6.1-sol", "gpt-6.1-sol-20261024"]) {
      assert.equal(book.priceFor(model, new Date("2026-10-27"))?.inputPerMTok, 99);
    }
    assert.equal(book.priceFor("gpt-6.1-sol", new Date("2026-10-23")), null);
  });

  it("keeps newer effective dates ahead of ties and never applies future overrides early", () => {
    const price = { model: "gpt-6.1-sol", inputPerMTok: 99, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 };
    const book = new PriceBook([{ ...price, from: "2026-10-01" }, { ...price, from: "2026-11-01", inputPerMTok: 123 }]);
    assert.equal(book.priceFor(price.model, new Date("2026-10-27"))?.inputPerMTok, 2);
    assert.equal(book.priceFor(price.model, new Date("2026-11-01"))?.inputPerMTok, 123);
  });

  it("are priced from 2026-10-24 at the nominal API-equivalent rates", () => {
    const book = new PriceBook();

    assert.deepEqual(book.cost("gpt-6.1-sol", MILLION, new Date("2026-10-25")), { costUsd: 2 + 10 + 0.1 + 2.5, isPriced: true });
    assert.deepEqual(book.cost("gpt-6-astra", MILLION, new Date("2026-10-25")), { costUsd: 10 + 50 + 1 + 12.5, isPriced: true });
  });

  it("aren't known before that date, so the fallback price guards the budget", () => {
    assert.equal(new PriceBook().cost("gpt-6.1-sol", MILLION, new Date("2026-10-23")).isPriced, false);
  });
});

import { readFileSync } from "node:fs";
import type { ModelPrice } from "./models/ModelPrice";
import type { TokenTotals } from "./models/TokenTotals";

const PER_MILLION = 1_000_000;
const BUNDLED_PRICES = new URL("./prices.json", import.meta.url);

// Prices are data: the bundled file plus host overrides; a newer `from` date wins for runs after it.
export class PriceBook {
  private readonly prices: ModelPrice[];
  private readonly fallback: ModelPrice | null;

  constructor(overrides: ModelPrice[] = [], fallback?: ModelPrice | null) {
    this.prices = [...readBundledPrices(), ...overrides].map((price) => ({ ...price, model: baseModel(price.model) }));
    this.fallback = fallback === undefined ? mostExpensive(this.prices) : fallback;
  }

  priceFor(model: string, at: Date): ModelPrice | null {
    const day = at.toISOString().slice(0, 10);
    const candidates = this.prices.filter((price) => price.model === baseModel(model) && price.from <= day);

    // Entries later in the input (host overrides) win an identical effective-date tie.
    return candidates.reverse().sort((a, b) => b.from.localeCompare(a.from))[0] ?? null;
  }

  // Unknown models are charged at the fallback price so they can't slip past budgets; `isPriced` says so.
  cost(model: string, tokens: TokenTotals, at: Date): { costUsd: number; isPriced: boolean } {
    const known = this.priceFor(model, at);
    const price = known ?? this.fallback;

    return { costUsd: price ? costOf(tokens, price) : 0, isPriced: known !== null };
  }
}

// Providers report dated ids ("claude-haiku-4-5-20251001"); prices are kept per base id.
export function baseModel(model: string): string {
  return model.replace(/-\d{8}$/, "");
}

function readBundledPrices(): ModelPrice[] {
  return (JSON.parse(readFileSync(BUNDLED_PRICES, "utf8")) as { prices: ModelPrice[] }).prices;
}

function costOf(tokens: TokenTotals, price: ModelPrice): number {
  const total =
    tokens.inputTokens * price.inputPerMTok +
    tokens.outputTokens * price.outputPerMTok +
    tokens.cacheReadTokens * price.cacheReadPerMTok +
    tokens.cacheWriteTokens * price.cacheWritePerMTok;

  return total / PER_MILLION;
}

function mostExpensive(prices: ModelPrice[]): ModelPrice | null {
  return [...prices].sort((a, b) => b.outputPerMTok - a.outputPerMTok)[0] ?? null;
}

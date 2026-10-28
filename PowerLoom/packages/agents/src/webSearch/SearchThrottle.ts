import type { WebSearchSettings } from "@powerloom/core";
import type { CachedAnswer } from "./models/CachedAnswer";
import type { ThrottleClock } from "./models/ThrottleClock";
import type { WebSearchAnswer } from "./models/WebSearchAnswer";
import type { WebSearchRequest } from "./models/WebSearchRequest";

type Pace = Pick<WebSearchSettings, "minSecondsBetweenSearches" | "cacheHours">;

// The answers kept at most; the oldest goes first. Runs search a few times a day, so this is only a ceiling.
const MAX_CACHED = 500;

const SYSTEM_CLOCK: ThrottleClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// SearXNG paces nothing itself: it only pauses an engine after it refused. So PowerLoom keeps the rate low before that
// (user decision 2026-10-28): one search at a time across every run of this runner, a gap between two, and the same
// search answered from the cache. No daily limit, and no retry of a refused search.
export class SearchThrottle {
  private queue: Promise<unknown> = Promise.resolve();
  private lastSearchAt = Number.NEGATIVE_INFINITY;
  private readonly answers = new Map<string, CachedAnswer>();

  constructor(private readonly clock: ThrottleClock = SYSTEM_CLOCK) {}

  search(request: WebSearchRequest, pace: Pace, run: () => Promise<WebSearchAnswer>): Promise<WebSearchAnswer> {
    const cached = this.fresh(cacheKey(request), pace.cacheHours);

    if (cached) {
      return Promise.resolve(cached);
    }

    const turn = this.queue.then(() => this.paced(cacheKey(request), pace, run));

    this.queue = turn.catch(() => undefined);

    return turn;
  }

  // The cache is asked again in turn: the same search may have been queued twice.
  private async paced(key: string, pace: Pace, run: () => Promise<WebSearchAnswer>): Promise<WebSearchAnswer> {
    const cached = this.fresh(key, pace.cacheHours);

    if (cached) {
      return cached;
    }

    await this.clock.sleep(this.waitMs(pace));
    this.lastSearchAt = this.clock.now();

    const answer = await run();

    this.remember(key, answer);

    return answer;
  }

  private waitMs(pace: Pace): number {
    return Math.max(0, this.lastSearchAt + pace.minSecondsBetweenSearches * 1000 - this.clock.now());
  }

  private fresh(key: string, cacheHours: number): WebSearchAnswer | null {
    const cached = this.answers.get(key);
    const isFresh = cached !== undefined && this.clock.now() - cached.savedAt < cacheHours * 3_600_000;

    return isFresh ? cached.answer : null;
  }

  // Only a complete answer is kept: one with engines that didn't respond is asked again next time.
  private remember(key: string, answer: WebSearchAnswer): void {
    if (answer.unresponsiveEngines.length > 0) {
      return;
    }

    this.answers.delete(key);
    this.answers.set(key, { answer, savedAt: this.clock.now() });

    if (this.answers.size > MAX_CACHED) {
      this.answers.delete(this.answers.keys().next().value!);
    }
  }
}

function cacheKey(request: WebSearchRequest): string {
  return JSON.stringify([request.query.trim().toLowerCase(), request.language, request.freshness]);
}

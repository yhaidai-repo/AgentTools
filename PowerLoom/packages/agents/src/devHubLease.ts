// A DevHub runs one stack and one browser case for one owner at a time. With several runs in one runner, the second
// run that needs a vault's DevHub waits for the first to end instead of failing against its stack (or stopping it).
// The lease lives in the runner process: one runner owns every run's DevHub use (a chat session's stack is DevHub's
// own owner check, as before). Keyed by the DevHub's URL, so vaults sharing a DevHub share its lease.

import type { AgentDeps } from "./models/AgentDeps";
import type { DevHubAccess } from "./models/DevHubAccess";

export type LeaseAnswer = { ok: true } | { ok: false; reason: string };

export interface LeaseWait {
  /** How long to wait for the holder to end before refusing; 0 refuses at once. */
  waitMs?: number;
  /** The run's stop: a stopped run gives up waiting. */
  signal?: AbortSignal;
}

// How long start_stack / browser_open wait for another run's DevHub use to end before they answer with a refusal.
export const DEVHUB_LEASE_WAIT_MS = 5 * 60_000;

// The runner's lease on the DevHub for this run (start_stack, browser_open), waited for while another run holds it; a
// chat session has no leases and keeps DevHub's own owner check.
export async function acquireDevHub(deps: AgentDeps, access: DevHubAccess, owner: string): Promise<LeaseAnswer> {
  return deps.devHubLeases ? deps.devHubLeases.acquire(access.url, owner, { signal: deps.stop }) : { ok: true };
}

export class DevHubLeases {
  private readonly holders = new Map<string, string>();
  private readonly waiters = new Map<string, Set<() => void>>();

  holder(url: string): string | null {
    return this.holders.get(url) ?? null;
  }

  /** The owner's lease on the DevHub, at once when it is free or the owner's already, else after the holder releases it. */
  async acquire(url: string, owner: string, wait: LeaseWait = {}): Promise<LeaseAnswer> {
    const deadline = Date.now() + (wait.waitMs ?? DEVHUB_LEASE_WAIT_MS);

    for (;;) {
      const holder = this.holders.get(url);

      if (holder === undefined || holder === owner) {
        this.holders.set(url, owner);

        return { ok: true };
      }

      if (wait.signal?.aborted) {
        return { ok: false, reason: `The run was stopped while waiting for DevHub ${url}, in use by ${holder}.` };
      }

      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        return { ok: false, reason: `DevHub ${url} is in use by ${holder} (its stack or browser case); it is free again when that run ends. Try again later, or finish without the local stack.` };
      }

      await this.releasedWithin(url, remaining, wait.signal);
    }
  }

  /** Frees every DevHub the owner holds (the run ended); a release by someone else is ignored. */
  release(owner: string): string[] {
    const freed: string[] = [];

    for (const [url, holder] of this.holders) {
      if (holder === owner) {
        this.holders.delete(url);
        freed.push(url);
        this.wake(url);
      }
    }

    return freed;
  }

  private releasedWithin(url: string, ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const waiting = this.waiters.get(url) ?? new Set();
      const done = () => {
        clearTimeout(timer);
        waiting.delete(done);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, ms);

      waiting.add(done);
      this.waiters.set(url, waiting);
      signal?.addEventListener("abort", done, { once: true });
    });
  }

  private wake(url: string): void {
    for (const waiter of [...(this.waiters.get(url) ?? [])]) {
      waiter();
    }
  }
}

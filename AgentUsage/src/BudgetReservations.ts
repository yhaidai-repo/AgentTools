import type { UsageLabels } from "./models/UsageLabels";

// A run's reserved share of the daily budgets, held from its start until it settles.
export interface BudgetReservation {
  readonly labels: UsageLabels;
  readonly amountUsd: number;
  /** Settles the reservation: the run's actual cost is in the store by then, so the reserve is no longer counted. */
  release(): void;
}

// The in-process ledger of what the runs that started but haven't settled yet may still spend. One runner process
// starts every run, so a ledger here is enough for its parallel runs to see each other (a second process would not).
// `reserve` decisions are taken one at a time (`serialize`), so two runs starting together can't both pass a check
// that only one of them fits.
export class BudgetReservations {
  private readonly held = new Set<BudgetReservation>();
  private queue: Promise<unknown> = Promise.resolve();

  /** The reserved amount of every unsettled run whose labels contain `match` (an empty match: all of them). */
  reservedFor(match: UsageLabels): number {
    let total = 0;

    for (const reservation of this.held) {
      if (matchesLabels(reservation.labels, match)) total += reservation.amountUsd;
    }

    return total;
  }

  add(labels: UsageLabels, amountUsd: number): BudgetReservation {
    const reservation: BudgetReservation = {
      labels,
      amountUsd: Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0,
      release: () => { this.held.delete(reservation); },
    };

    this.held.add(reservation);

    return reservation;
  }

  /** Runs `decide` after every earlier decision settled, so a check and its reservation are one step. */
  serialize<T>(decide: () => Promise<T>): Promise<T> {
    const next = this.queue.then(decide, decide);

    this.queue = next.catch(() => undefined);

    return next;
  }

  get count(): number {
    return this.held.size;
  }
}

export function matchesLabels(labels: UsageLabels, match: UsageLabels): boolean {
  return Object.entries(match).every(([key, value]) => labels[key] === value);
}

// The ledger every guard shares unless given another (tests).
export const SHARED_BUDGET_RESERVATIONS = new BudgetReservations();

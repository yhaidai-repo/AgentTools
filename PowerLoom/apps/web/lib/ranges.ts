import { DEFAULT_PERIOD, PERIODS, SPRINT_PERIOD } from "@powerloom/core";

// The periods live in core (shared with the read commands); the web keeps its older names and the switch's options.
export { PERIODS, fixedPeriodStart, periodOf, periodPhrase, weekStart } from "@powerloom/core";

export const DEFAULT_RANGE = DEFAULT_PERIOD;

export const SPRINT_RANGE = SPRINT_PERIOD;

// For the period switch (functions can't cross to the browser).
export function rangeOptions(): { key: string; label: string }[] {
  return PERIODS.map(({ key, label }) => ({ key, label }));
}

// The logs API runs KQL queries only; these guards keep an agent inside the caps the design sets.
const MAX_TIMESPAN_HOURS = 30 * 24;
const DEFAULT_TIMESPAN = "24h";

const TIMESPAN = /^(\d+)\s*([mhd])$/i;

// Why the text may not run, or null. The query API can't run management commands (`.show`, `.set`), and a leading
// `set` statement could lift the result caps, so both are refused before the call.
export function kqlProblem(query: string): string | null {
  const code = query.trim();

  if (code.length === 0) {
    return "The query is empty.";
  }

  if (code.startsWith(".")) {
    return "Read only: management commands (.show, .set, …) aren't allowed; write a KQL query, e.g. requests | take 10.";
  }

  if (/^set\s/i.test(code)) {
    return "A leading `set` statement isn't allowed; the result caps stay as they are.";
  }

  return null;
}

// "30m", "24h" or "7d" → an ISO 8601 duration for the API, capped at 30 days; empty = the last 24 hours.
export function timespanDuration(timespan: string | undefined): { duration: string } | { problem: string } {
  const match = TIMESPAN.exec((timespan ?? DEFAULT_TIMESPAN).trim());

  if (!match) {
    return { problem: `A timespan is a number and a unit: 30m, 24h or 7d (at most 30d); got "${timespan}".` };
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const hours = unit === "d" ? amount * 24 : unit === "h" ? amount : amount / 60;

  if (hours <= 0 || hours > MAX_TIMESPAN_HOURS) {
    return { problem: `A timespan is at most 30 days; got "${timespan}".` };
  }

  return { duration: unit === "d" ? `P${amount}D` : unit === "h" ? `PT${amount}H` : `PT${amount}M` };
}

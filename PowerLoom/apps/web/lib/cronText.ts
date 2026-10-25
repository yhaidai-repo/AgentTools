// A schedule's cron as people say it (user decision 2026-10-18): "*/5 * * * *" → "every 5 min", "0 */6 * * *" →
// "every 6 h", "30 7 * * *" → "daily at 07:30", "0 6 * * 1,4" → "Mon, Thu at 06:00". Anything else stays as written.
const PATTERNS: { pattern: RegExp; text: (match: RegExpExecArray) => string }[] = [
  { pattern: /^\* \* \* \* \*$/, text: () => "every minute" },
  { pattern: /^\*\/(\d+) \* \* \* \*$/, text: (match) => `every ${match[1]} min` },
  { pattern: /^0 \* \* \* \*$/, text: () => "every hour" },
  { pattern: /^0 \*\/(\d+) \* \* \*$/, text: (match) => `every ${match[1]} h` },
  { pattern: /^(\d+) (\d+) \* \* \*$/, text: (match) => `daily at ${pad(match[2])}:${pad(match[1])}` },
  { pattern: /^(\d+) (\d+) \* \* 1-5$/, text: (match) => `weekdays at ${pad(match[2])}:${pad(match[1])}` },
  { pattern: /^(\d+) (\d+) \* \* ([0-7](?:,[0-7])*)$/, text: (match) => `${dayNames(match[3])} at ${pad(match[2])}:${pad(match[1])}` },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function cronText(cron: string): string {
  const trimmed = cron.trim();

  const found = PATTERNS.map((entry) => ({ entry, match: entry.pattern.exec(trimmed) })).find((candidate) => candidate.match !== null);

  return found?.match ? found.entry.text(found.match) : trimmed;
}

function dayNames(days: string): string {
  return days.split(",").map((day) => DAYS[Number(day)]).join(", ");
}

function pad(value: string): string {
  return value.padStart(2, "0");
}

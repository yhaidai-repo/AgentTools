export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }

  return count >= 1_000 ? `${(count / 1_000).toFixed(1)}k` : String(count);
}

// Four decimals for cents-level amounts (a cheap run), two otherwise; zero is plain.
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount > 0 && amount < 1 ? 4 : 2)}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);

  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

// A stay in hours as people say it, in its two largest units: "1 d 10 h", "1 h 24 min", "12 min".
export function formatHours(hours: number): string {
  const minutes = Math.round(hours * 60);
  const days = Math.floor(minutes / 1440);
  const restHours = Math.floor((minutes % 1440) / 60);
  const restMinutes = minutes % 60;

  if (days > 0) {
    return restHours > 0 ? `${days} d ${restHours} h` : `${days} d`;
  }

  if (restHours > 0) {
    return restMinutes > 0 ? `${restHours} h ${restMinutes} min` : `${restHours} h`;
  }

  return minutes > 0 ? `${minutes} min` : "<1 min";
}

const AGE_UNITS = [
  { suffix: "d", ms: 24 * 60 * 60 * 1000 },
  { suffix: "h", ms: 60 * 60 * 1000 },
  { suffix: "m", ms: 60 * 1000 },
];

// How long ago, in the largest whole unit: 3d, 5h, 12m.
export function formatAge(ms: number): string {
  const unit = AGE_UNITS.find((candidate) => ms >= candidate.ms);

  return unit ? `${Math.floor(ms / unit.ms)}${unit.suffix}` : "<1m";
}

// The day of a YYYY-MM-DD date, for a chart's x axis: 2026-10-05 → 5.
export function formatDayOfMonth(day: string): string {
  return String(Number(day.slice(8, 10)));
}

export function average(total: number, count: number): number {
  return count > 0 ? total / count : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return bytes >= 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;
}

// A 0–1 fraction as whole percent.
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// A run's share is a split of a whole period's change, so it is finer than the provider's whole percents.
export function formatSharePercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }

  return count >= 1_000 ? `${(count / 1_000).toFixed(1)}k` : String(count);
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount < 1 ? 4 : 2)}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);

  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
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

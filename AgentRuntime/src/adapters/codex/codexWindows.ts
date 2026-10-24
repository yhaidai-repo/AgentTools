import type { SubscriptionWindow } from "../../models/SubscriptionWindow";

export const CODEX_PROVIDER = "openai-codex";

export function codexWindows(value: unknown): SubscriptionWindow[] {
  const limits = objectOf(value);

  return [windowOf(limits.primary, "five_hour", "5-hour"), windowOf(limits.secondary, "weekly", "Weekly")]
    .filter((window): window is SubscriptionWindow => window !== null);
}

export function objectOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function windowOf(value: unknown, window: string, label: string): SubscriptionWindow | null {
  const data = objectOf(value);
  const percent = data.used_percent;

  if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0) {
    return null;
  }

  return { provider: CODEX_PROVIDER, window, label, utilization: Math.min(percent / 100, 1), resetsAt: resetOf(data.resets_at) };
}

function resetOf(value: unknown): Date | null {
  const date = typeof value === "number" ? new Date(value * 1000) : null;

  return date && Number.isFinite(date.getTime()) ? date : null;
}

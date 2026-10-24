import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SubscriptionWindow } from "../../models/SubscriptionWindow";

export const CLAUDE_PROVIDER = "anthropic";

type RateLimitInfo = Extract<SDKMessage, { type: "rate_limit_event" }>["rate_limit_info"];

// Not in the SDK's types (runtime-verified, SDK 0.3.286): every rate-limit event of a subscription carries all windows.
type UnifiedWindows = Record<string, { utilization?: number; resetsAt?: number }>;

/** The /usage data call's windows: utilization in percent (0–100), ISO reset times. */
export type UsageCallLimits = Record<string, { utilization: number | null; resets_at: string | null } | null | undefined>;

const LABELS: Record<string, string> = {
  five_hour: "5-hour",
  seven_day: "Weekly",
  seven_day_sonnet: "Weekly Sonnet",
  seven_day_opus: "Weekly Opus",
  seven_day_oauth_apps: "Weekly apps",
};

// From a run's rate-limit event: all windows when the SDK sends them, otherwise the one the event is about.
export function windowsOfRateLimit(info: RateLimitInfo): SubscriptionWindow[] {
  const unified = (info as RateLimitInfo & { unifiedWindows?: UnifiedWindows }).unifiedWindows;

  if (unified) {
    return Object.entries(unified)
      .filter(([, value]) => typeof value.utilization === "number")
      .map(([window, value]) => claudeWindow(window, value.utilization!, fromEpochSeconds(value.resetsAt)));
  }

  return info.rateLimitType && typeof info.utilization === "number"
    ? [claudeWindow(info.rateLimitType, info.utilization, fromEpochSeconds(info.resetsAt))]
    : [];
}

export function windowsOfUsageCall(limits: UsageCallLimits): SubscriptionWindow[] {
  return Object.entries(limits)
    .filter(([, value]) => typeof value?.utilization === "number")
    .map(([window, value]) => claudeWindow(window, value!.utilization! / 100, value!.resets_at ? new Date(value!.resets_at) : null));
}

export function fromEpochSeconds(epochSeconds: number | undefined): Date | null {
  return epochSeconds ? new Date(epochSeconds * 1000) : null;
}

function claudeWindow(window: string, utilization: number, resetsAt: Date | null): SubscriptionWindow {
  return { provider: CLAUDE_PROVIDER, window, label: LABELS[window] ?? window, utilization, resetsAt };
}

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { SubscriptionReport } from "../../models/SubscriptionReport";
import type { SubscriptionWindow } from "../../models/SubscriptionWindow";
import { CLAUDE_PROVIDER, windowsOfRateLimit, windowsOfUsageCall, type UsageCallLimits } from "./claudeWindows";

// The cheapest model and the shortest answer: a probe only exists to receive the rate-limit event.
const PROBE_MODEL = "claude-haiku-4-5";
const PROBE_PROMPT = "Reply with OK.";
const QUIET_OPTIONS: Options = { settingSources: [], tools: [], allowedTools: [] };

// The free way: the data behind Claude Code's /usage, without a model request. It needs a token with the profile scope
// (an inference-only `claude setup-token` token gets "unavailable"). The SDK marks the call experimental.
export async function readUsageCall(): Promise<SubscriptionReport> {
  let release: () => void = () => {};
  const idle = new Promise<void>((resolve) => {
    release = resolve;
  });
  const session = query({ prompt: waitFor(idle), options: QUIET_OPTIONS });

  try {
    const usage = await session.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true });
    const windows = usage.rate_limits ? windowsOfUsageCall(usage.rate_limits as UsageCallLimits) : [];

    return report(usage.subscription_type, windows, windows.length > 0 ? null : "the token can't read plan limits (it needs the profile scope)");
  } catch (error) {
    return report(null, [], `the /usage call failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    release();
    session.close();
  }
}

// One minimal model request (it uses a small part of the subscription itself); its rate-limit event has every window.
export async function probeWindows(): Promise<SubscriptionWindow[]> {
  let windows: SubscriptionWindow[] = [];

  for await (const message of query({ prompt: PROBE_PROMPT, options: { ...QUIET_OPTIONS, model: PROBE_MODEL, maxTurns: 1 } })) {
    windows = message.type === "rate_limit_event" ? windowsOfRateLimit(message.rate_limit_info) : windows;
  }

  return windows;
}

export function report(plan: string | null, windows: SubscriptionWindow[], unavailable: string | null, checkedAt = new Date()): SubscriptionReport {
  return { provider: CLAUDE_PROVIDER, plan, windows, checkedAt, unavailable: windows.length > 0 ? null : unavailable };
}

// A streaming prompt that never sends a message: the session stays open for control requests only.
async function* waitFor(idle: Promise<void>): AsyncIterable<never> {
  await idle;
}

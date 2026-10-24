import type { EventBody } from "../../EventSequence";
import type { SubscriptionReport } from "../../models/SubscriptionReport";
import { CodexRollouts } from "./CodexRollouts";
import { CODEX_PROVIDER, codexWindows, objectOf } from "./codexWindows";

export class CodexSubscription {
  private readonly rollouts: CodexRollouts;

  constructor(codexHome: string) {
    this.rollouts = new CodexRollouts(codexHome);
  }

  async usage(threadId?: string): Promise<SubscriptionReport> {
    const count = await this.rollouts.latestTokenCount(threadId);
    const windows = codexWindows(count?.rateLimits);
    const plan = objectOf(count?.rateLimits).plan_type;

    return {
      provider: CODEX_PROVIDER,
      plan: typeof plan === "string" ? plan : null,
      windows,
      checkedAt: count?.at ?? new Date(),
      unavailable: windows.length === 0 ? "No readable Codex subscription windows in the local rollouts." : null,
    };
  }

  async event(threadId: string): Promise<EventBody[]> {
    const report = await this.usage(threadId);
    const highest = [...report.windows].sort((a, b) => b.utilization - a.utilization)[0];

    if (!highest) {
      return [];
    }

    const status = highest.utilization >= 1 ? "rejected" : highest.utilization >= 0.8 ? "warning" : "allowed";

    return [{ type: "rate_limit", status, resetsAt: highest.resetsAt, utilization: highest.utilization, windows: report.windows }];
  }
}

import type { AgentEvent } from "./AgentEvent";
import type { AgentRequest } from "./AgentRequest";
import type { SubscriptionQuery } from "./SubscriptionQuery";
import type { SubscriptionReport } from "./SubscriptionReport";

// One implementation per provider. Callers depend only on this contract.
export interface AgentRuntime {
  readonly provider: string;
  /**
   * True when runs report the subscription's windows themselves (rate_limit events); otherwise a host that wants a
   * run's share asks subscriptionUsage() before and after the run.
   */
  readonly reportsSubscriptionInRuns: boolean;
  run(request: AgentRequest): AsyncIterable<AgentEvent>;
  subscriptionUsage(query?: SubscriptionQuery): Promise<SubscriptionReport>;
}

import type { AgentRuntime } from "./models/AgentRuntime";
import type { SubscriptionQuery } from "./models/SubscriptionQuery";
import type { SubscriptionReport } from "./models/SubscriptionReport";

// Hosts register one adapter per provider; agents pick theirs by their configured model's provider.
export class RuntimeRegistry {
  private readonly runtimes = new Map<string, AgentRuntime>();

  register(runtime: AgentRuntime): this {
    this.runtimes.set(runtime.provider, runtime);

    return this;
  }

  get(provider: string): AgentRuntime {
    const runtime = this.runtimes.get(provider);

    if (!runtime) {
      throw new Error(`No runtime registered for provider "${provider}". Registered: ${this.providers().join(", ")}`);
    }

    return runtime;
  }

  providers(): string[] {
    return [...this.runtimes.keys()];
  }

  // Every registered provider's subscription usage; one that can't tell says so in its report.
  subscriptionUsage(query: SubscriptionQuery = {}): Promise<SubscriptionReport[]> {
    return Promise.all([...this.runtimes.values()].map((runtime) => runtime.subscriptionUsage(query)));
  }
}

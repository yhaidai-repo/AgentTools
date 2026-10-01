import type { AgentRuntime } from "./models/AgentRuntime";

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
}

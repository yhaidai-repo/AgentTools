import type { AgentEvent, AgentRequest, AgentRuntime, SubscriptionQuery, SubscriptionReport } from "@agenttools/runtime";
import type { WorkspaceResolver } from "./WorkspaceResolver";

// A runtime that runs a request with a workspace in that workspace's worktree, and gives the repo back when the run ends,
// also when it fails or is stopped.
export class WorkspaceRuntime implements AgentRuntime {
  constructor(private readonly inner: AgentRuntime, private readonly workspaces: WorkspaceResolver) {}

  get provider(): string {
    return this.inner.provider;
  }

  get reportsSubscriptionInRuns(): boolean {
    return this.inner.reportsSubscriptionInRuns;
  }

  get conversations(): AgentRuntime["conversations"] {
    return this.inner.conversations;
  }

  async *run(request: AgentRequest): AsyncIterable<AgentEvent> {
    const workspace = await this.workspaces.resolve(request);

    try {
      yield* this.inner.run(workspace.request);
    } finally {
      workspace.release();
    }
  }

  subscriptionUsage(query?: SubscriptionQuery): Promise<SubscriptionReport> {
    return this.inner.subscriptionUsage(query);
  }
}

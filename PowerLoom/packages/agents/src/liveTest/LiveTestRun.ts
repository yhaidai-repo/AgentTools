import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { CommandContext } from "@powerloom/core";
import type { AgentDeps } from "../models/AgentDeps";
import { cleanUpLiveTest } from "./cleanUpLiveTest";
import { itemPbiOf } from "./itemPbiOf";
import { liveTestContext } from "./liveTestContext";
import { LIVE_TEST_INTEGRATION, liveTestTools } from "./liveTestTools";
import { LiveTestScope } from "./LiveTestScope";
import type { LiveTestCleanupReport } from "./models/LiveTestCleanupReport";

/** One run's live test: its command tools, what it created, and the cleanup of that when the run ends. */
export class LiveTestRun {
  private constructor(private readonly context: CommandContext, private readonly scope: LiveTestScope) {}

  /** The live test of an agent with the grant on; null without it. */
  static granted(agent: AgentDefinition, deps: AgentDeps): LiveTestRun | null {
    if (agent.capabilities.integrations?.[LIVE_TEST_INTEGRATION] !== true) {
      return null;
    }

    return LiveTestRun.on(liveTestContext(deps, agent.id), new LiveTestScope(itemPbiOf(deps.db)));
  }

  static on(context: CommandContext, scope: LiveTestScope): LiveTestRun {
    return new LiveTestRun(context, scope);
  }

  get holdsData(): boolean {
    return !this.scope.isEmpty;
  }

  tools(taken: Set<string>): { reads: ToolDefinition<any>[]; writes: ToolDefinition<any>[] } {
    return liveTestTools(this.context, this.scope, taken);
  }

  cleanUp(): Promise<LiveTestCleanupReport> {
    return cleanUpLiveTest(this.scope, this.context);
  }
}

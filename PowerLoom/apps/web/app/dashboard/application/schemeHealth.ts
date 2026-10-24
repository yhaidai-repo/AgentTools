import type { ProviderStatus } from "@/lib/aiProviders";
import type { StateLevel, SystemStatus } from "@/lib/systemStatus";
import { SCHEME_NODES } from "./architecture";

export type NodeHealth = StateLevel | "off";

/** What the web asks beside PowerLoom's status: the AI providers (null while PowerLoom can't say) and the MCP server. */
export interface SchemeExtras {
  providers: ProviderStatus[] | null;
  mcpAnswers: boolean;
}

// The provider nodes of the scheme, by the provider ids of Settings → AI providers.
const PROVIDER_NODES: Record<string, string> = { anthropic: "claude", "openai-codex": "codex" };

const ORDER: Record<NodeHealth, number> = { off: 0, ok: 1, degraded: 2, failed: 3 };

// What color each node gets: the status of the components PowerLoom reports, the outside systems the agents read (and
// their tool nodes), the attention entries' components, the providers (connected or off) and the MCP server, and for
// every parent the worst of its children (so a problem shows from the top level down).
export function schemeHealth(status: SystemStatus | null, extras: SchemeExtras = { providers: null, mcpAnswers: false }): Record<string, NodeHealth> {
  const health: Record<string, NodeHealth> = { ...(status ? ownStates(status) : { powerloom: "failed", "pl-http": "failed" }), ...extraStates(extras) };

  for (const node of SCHEME_NODES) {
    for (let parent = node.parent; parent; parent = SCHEME_NODES.find((candidate) => candidate.id === parent)?.parent) {
      health[parent] = worse(health[parent], health[node.id]);
    }
  }

  return health;
}

function ownStates(status: SystemStatus): Record<string, NodeHealth> {
  const states: Record<string, NodeHealth> = {
    database: status.database.state,
    "schedule-ticker": status.ticker.state,
    "agent-runner": status.runner.state,
    "runner-server": status.runner.state,
    "runner-client": status.runner.state,
    "dead-letter-store": status.messaging.deadLetters > 0 ? "degraded" : "ok",
    confluence: status.confluenceConfigured ? "ok" : "off",
    "confluence-integration": status.confluenceConfigured ? "ok" : "off",
    "ado-sync": syncState(status, "sync"),
    "ado-pull-requests": syncState(status, "pull-requests"),
    ado: status.vaults.some((vault) => vault.adoEnabled && vault.adoConfigured) ? "ok" : "off",
    "agent-runs": status.runs.some((run) => run.stuck) ? "degraded" : "ok",
    powerloom: "ok",
    "pl-http": "ok",
    web: "ok",
  };

  for (const outside of status.outside) {
    states[outside.component] = worse(states[outside.component], outside.state);
    states[outside.tool] = worse(states[outside.tool], outside.state);
  }

  for (const item of status.attention) {
    states[item.component] = worse(states[item.component], item.severity);
  }

  return states;
}

// A provider that isn't connected is off, not a failure: Codex is optional (owner's decision 2026-10-24).
function extraStates(extras: SchemeExtras): Record<string, NodeHealth> {
  const states: Record<string, NodeHealth> = { mcp: extras.mcpAnswers ? "ok" : "failed" };

  for (const provider of extras.providers ?? []) {
    states[PROVIDER_NODES[provider.provider] ?? provider.provider] = provider.connected ? "ok" : "off";
  }

  return states;
}

function syncState(status: SystemStatus, stage: string): NodeHealth {
  const latest = status.recentSyncs.find((run) => run.stage === stage);

  if (!latest) {
    return "off";
  }

  return latest.outcome === "failed" ? "degraded" : "ok";
}

function worse(a: NodeHealth | undefined, b: NodeHealth | undefined): NodeHealth {
  const left = a ?? "off";
  const right = b ?? "off";

  return ORDER[left] >= ORDER[right] ? left : right;
}

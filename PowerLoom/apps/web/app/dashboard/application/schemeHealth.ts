import type { StateLevel, SystemStatus } from "@/lib/systemStatus";
import { SCHEME_NODES } from "./architecture";

export type NodeHealth = StateLevel | "off";

const ORDER: Record<NodeHealth, number> = { off: 0, ok: 1, degraded: 2, failed: 3 };

// What color each node gets: the status of the components PowerLoom reports, the attention entries' components, and
// for every parent the worst of its children (so a problem shows from the top level down).
export function schemeHealth(status: SystemStatus | null): Record<string, NodeHealth> {
  const health: Record<string, NodeHealth> = status ? ownStates(status) : { powerloom: "failed", "pl-http": "failed" };

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

  for (const item of status.attention) {
    states[item.component] = worse(states[item.component], item.severity);
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

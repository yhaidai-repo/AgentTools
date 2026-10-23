import type { DataAccessKind } from "@powerloom/db";
import { z } from "zod";
import { runRef } from "../agentRuns/vaultRuns";
import { ALL_ACCESS_AGENTS, configuredResources, latestCalls, loadDataAccess, resourceUsage } from "../agentStats/dataAccess";
import type { Command } from "../models/Command";
import type { DataAccessCall } from "../models/DataAccessCall";
import type { ResourceUsage } from "../models/ResourceUsage";
import { periodStart } from "../periods";
import { limitInput, periodInput, vaultInput } from "./inputs";

// A request is shown as sent, cut for a chat (the log keeps it whole).
const MAX_REQUEST_CHARS = 300;

const DATA_ACCESS_KINDS = ["sql", "azure", "cosmos", "mongo", "serviceBus", "confluence", "localStack", "ado", "repo", "docs", "web", "skills", "internal", "other"] as const satisfies readonly DataAccessKind[];

const input = z.object({
  vault: vaultInput,
  period: periodInput,
  agent: z.string().trim().min(1).optional().describe("Only this agent's calls (its id); every agent when left out"),
  kind: z.enum(DATA_ACCESS_KINDS).optional().describe("Only calls to resources of this kind, e.g. sql, azure, confluence"),
  limit: limitInput(500, 100),
});

type DataAccessInput = z.infer<typeof input>;

interface DataAccessEntry {
  startedAt: Date;
  agentId: string;
  runId: string | null;
  tool: string;
  kind: string;
  resource: string;
  target: string;
  request: string;
  outcome: string;
  reason: string | null;
  rows: number | null;
  durationMs: number;
}

// The Tools tab: the vault's data access log in the period, newest first, and each configured resource's use.
export const listDataAccessCommand: Command<DataAccessInput, { calls: DataAccessEntry[]; resources: ResourceUsage[] }> = {
  name: "access.list",
  effect: "read",
  description: "List the outside reads a vault's agents made in a period (the data access log): when, agent, run, tool, resource and target, the request cut to 300 chars, outcome, reason and rows; plus every configured resource with its calls in the period and its last use ever. Filter by agent id and kind.",
  input,
  async run(context, input) {
    const since = await periodStart(context.db, input.period, input.vault);
    const calls = (await loadDataAccess(context.db, input.vault, since, input.agent ?? ALL_ACCESS_AGENTS)).filter((call) => !input.kind || call.kind === input.kind);
    const configured = (await configuredResources(context.db, input.vault)).filter((resource) => !input.kind || resource.kind === input.kind);
    const resources = resourceUsage(configured, calls, await latestCalls(context.db, input.vault));

    return { ok: true, value: { calls: calls.slice(0, input.limit).map(entryOf), resources } };
  },
};

function entryOf(call: DataAccessCall): DataAccessEntry {
  return {
    startedAt: call.startedAt,
    agentId: call.agentId,
    runId: call.runId === null ? null : runRef(call.runId),
    tool: call.tool,
    kind: call.kind,
    resource: call.resource,
    target: call.target,
    request: call.request.length > MAX_REQUEST_CHARS ? `${call.request.slice(0, MAX_REQUEST_CHARS)}…` : call.request,
    outcome: call.outcome,
    reason: call.reason,
    rows: call.rows,
    durationMs: call.durationMs,
  };
}

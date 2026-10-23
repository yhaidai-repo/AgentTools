import { dataAccess, type DataAccessKind, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, gte } from "drizzle-orm";
import type { ConfiguredResource } from "../models/ConfiguredResource";
import type { DataAccessCall } from "../models/DataAccessCall";
import type { ResourceUsage } from "../models/ResourceUsage";
import { readReadAzureSettings, readReadSqlSettings } from "../settings";

export const ALL_ACCESS_AGENTS = "all";

// The vault's log rows since the period's start, newest first, by the chosen agent.
export async function loadDataAccess(db: PowerLoomDb, vault: string, since: Date, agent: string): Promise<DataAccessCall[]> {
  const byAgent = agent === ALL_ACCESS_AGENTS ? [] : [eq(dataAccess.agentId, agent)];

  return db.select().from(dataAccess).where(and(eq(dataAccess.vault, vault), gte(dataAccess.startedAt, since), ...byAgent)).orderBy(desc(dataAccess.startedAt));
}

// Agents in the vault's log, for the filter.
export async function dataAccessAgents(db: PowerLoomDb, vault: string): Promise<string[]> {
  const rows = await db.selectDistinct({ agentId: dataAccess.agentId }).from(dataAccess).where(eq(dataAccess.vault, vault));

  return [ALL_ACCESS_AGENTS, ...rows.map((row) => row.agentId).sort()];
}

// Every resource the vault can read today (Settings), so the Tools tab can list the ones nobody used. Confluence is
// set up in .env, not per vault: it appears once a call was logged.
export async function configuredResources(db: PowerLoomDb, vault: string): Promise<ConfiguredResource[]> {
  const sql = (await readReadSqlSettings(db, vault)).connections.map((connection) => ({ kind: "sql" as const, resource: connection.name, target: `${connection.server}/${connection.database || "default"}` }));
  const azure = (await readReadAzureSettings(db, vault)).resources.map((resource) => ({ kind: resource.kind as DataAccessKind, resource: resource.target, target: resource.display }));

  return [...sql, ...azure];
}

// Each resource's use: the period's rows by the chosen agent, plus the latest call ever for "last used".
export function resourceUsage(configured: ConfiguredResource[], inPeriod: DataAccessCall[], latestEver: Map<string, Date>): ResourceUsage[] {
  const seen = new Map<string, ConfiguredResource>(configured.map((resource) => [keyOf(resource), resource]));

  for (const row of inPeriod) {
    seen.set(keyOf(row), { kind: row.kind as DataAccessKind, resource: row.resource, target: row.target });
  }

  return [...seen.values()].map((resource) => usageOf(resource, inPeriod.filter((row) => keyOf(row) === keyOf(resource)), latestEver.get(keyOf(resource)) ?? null));
}

// The latest call per resource over the whole log (any agent), for the "last used" column.
export async function latestCalls(db: PowerLoomDb, vault: string): Promise<Map<string, Date>> {
  const rows = await db.select({ kind: dataAccess.kind, resource: dataAccess.resource, startedAt: dataAccess.startedAt }).from(dataAccess).where(eq(dataAccess.vault, vault)).orderBy(desc(dataAccess.startedAt));
  const latest = new Map<string, Date>();

  for (const row of rows) {
    const key = keyOf(row);

    if (!latest.has(key)) {
      latest.set(key, row.startedAt);
    }
  }

  return latest;
}

export function isResourceUsed(usage: ResourceUsage): boolean {
  return usage.calls > 0;
}

function usageOf(resource: ConfiguredResource, rows: DataAccessCall[], lastUsed: Date | null): ResourceUsage {
  const count = (outcome: string) => rows.filter((row) => row.outcome === outcome).length;

  return {
    ...resource,
    calls: rows.length,
    ok: count("ok"),
    refused: count("refused"),
    denied: count("denied"),
    failed: count("failed"),
    rows: rows.reduce((sum, row) => sum + (row.rows ?? 0), 0),
    agents: [...new Set(rows.map((row) => row.agentId))].sort(),
    lastUsed,
  };
}

function keyOf(entry: { kind: string; resource: string }): string {
  return `${entry.kind}:${entry.resource}`;
}

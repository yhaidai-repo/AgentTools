import { runFailureReport, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { FailureReportGroup } from "../models/FailureReportGroup";

export const ALL_FAILURE_AGENTS = "all";

/** The causes reported in the period, the most reported first: repeated failures stand out. */
export async function loadFailureReportGroups(db: PowerLoomDb, vault: string, since: Date, agent: string): Promise<FailureReportGroup[]> {
  const reports = sql<number>`count(*)::int`;
  const lastReportedAt = sql<Date>`max(${runFailureReport.createdAt})`;

  return db.select({
    kind: runFailureReport.kind,
    tool: runFailureReport.tool,
    target: runFailureReport.target,
    reports,
    runs: sql<number>`count(distinct ${runFailureReport.runId})::int`,
    agents: sql<string[]>`array_agg(distinct ${runFailureReport.agentId})`,
    lastReportedAt,
  }).from(runFailureReport)
    .where(and(eq(runFailureReport.vault, vault), gte(runFailureReport.createdAt, since), ...byAgent(agent)))
    .groupBy(runFailureReport.kind, runFailureReport.tool, runFailureReport.target)
    .orderBy(desc(reports), desc(lastReportedAt));
}

/** The latest reports in the period, newest first. */
export async function loadRecentFailureReports(db: PowerLoomDb, vault: string, since: Date, agent: string, limit: number) {
  return db.select().from(runFailureReport)
    .where(and(eq(runFailureReport.vault, vault), gte(runFailureReport.createdAt, since), ...byAgent(agent)))
    .orderBy(desc(runFailureReport.createdAt))
    .limit(limit);
}

function byAgent(agent: string) {
  return agent === ALL_FAILURE_AGENTS ? [] : [eq(runFailureReport.agentId, agent)];
}

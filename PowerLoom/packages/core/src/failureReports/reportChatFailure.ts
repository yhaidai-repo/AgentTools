import { budgetDayStart } from "@agenttools/usage";
import { runFailureReport, type PowerLoomDb } from "@powerloom/db";
import { and, eq, gte, isNull } from "drizzle-orm";
import type { NewFailureReport } from "../models/NewFailureReport";
import { insertFailureReport } from "./insertFailureReport";

/** A chat has no run to hold its reports: the first of a day counts, the same cause again that day names it. */
export async function reportChatFailure(db: PowerLoomDb, report: NewFailureReport): Promise<{ id: number; repeat: boolean }> {
  const earlier = await reportedToday(db, report);

  if (earlier !== null) {
    return { id: earlier, repeat: true };
  }

  return { id: await insertFailureReport(db, report), repeat: false };
}

async function reportedToday(db: PowerLoomDb, report: NewFailureReport): Promise<number | null> {
  const sameTool = report.tool === null ? isNull(runFailureReport.tool) : eq(runFailureReport.tool, report.tool);
  const rows = await db.select({ id: runFailureReport.id }).from(runFailureReport).where(and(
    eq(runFailureReport.origin, "chat"),
    eq(runFailureReport.vault, report.vault),
    report.actor === null ? isNull(runFailureReport.actor) : eq(runFailureReport.actor, report.actor),
    eq(runFailureReport.kind, report.kind),
    sameTool,
    eq(runFailureReport.target, report.target),
    gte(runFailureReport.createdAt, budgetDayStart()),
  )).limit(1);

  return rows[0]?.id ?? null;
}

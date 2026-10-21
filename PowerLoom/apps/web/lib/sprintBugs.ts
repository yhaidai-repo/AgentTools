import { bug, workItem } from "@powerloom/db";
import { alias } from "drizzle-orm/pg-core";
import { count, eq, sql } from "drizzle-orm";
import type { SprintBugs } from "@/models/SprintBugs";
import { getDb } from "./db";

const parent = alias(workItem, "parent");

const AGENT_PREFIX = "agent:";

// The vault's bugs per sprint, oldest sprint first. A bug counts in its own sprint; one PowerLoom reported has none, so
// it counts in its parent PBI's.
export async function loadSprintBugs(vault: string): Promise<SprintBugs[]> {
  const sprint = sql<string | null>`coalesce(${workItem.iterationPath}, ${parent.iterationPath})`;
  const rows = await getDb()
    .select({ sprint, source: bug.source, reportedBy: bug.reportedBy, bugs: count() })
    .from(bug)
    .innerJoin(workItem, eq(workItem.adoId, bug.workItemId))
    .leftJoin(parent, eq(parent.adoId, bug.pbiId))
    .where(sql`coalesce(${workItem.vault}, ${parent.vault}) = ${vault}`)
    .groupBy(sprint, bug.source, bug.reportedBy);

  return toSprints(rows.filter((row): row is typeof row & { sprint: string } => row.sprint !== null));
}

function toSprints(rows: { sprint: string; source: string; reportedBy: string; bugs: number }[]): SprintBugs[] {
  const sprints = new Map<string, SprintBugs>();

  for (const row of rows) {
    addBugs(sprints.get(row.sprint) ?? newSprint(sprints, row.sprint), row);
  }

  return [...sprints.values()].sort((a, b) => a.iterationPath.localeCompare(b.iterationPath, undefined, { numeric: true }));
}

function newSprint(sprints: Map<string, SprintBugs>, iterationPath: string): SprintBugs {
  const created: SprintBugs = { iterationPath, qa: 0, powerloom: 0, byReporter: {} };

  sprints.set(iterationPath, created);

  return created;
}

// From Azure DevOps is QA's; anything reported inside PowerLoom is PowerLoom's (user decision 2026-10-21: a bug reported
// from a chat counts with PowerLoom).
function addBugs(sprint: SprintBugs, row: { source: string; reportedBy: string; bugs: number }): void {
  if (row.source === "ado") {
    sprint.qa += row.bugs;

    return;
  }

  const reporter = reporterOf(row.reportedBy);

  sprint.powerloom += row.bugs;
  sprint.byReporter[reporter] = (sprint.byReporter[reporter] ?? 0) + row.bugs;
}

function reporterOf(reportedBy: string): string {
  return reportedBy.startsWith(AGENT_PREFIX) ? reportedBy.slice(AGENT_PREFIX.length) : "chat";
}

import type { Pool, PoolClient } from "pg";
import { COLUMN_RENAMES, renameColumn, renameScheduleDescriptions, renameUsageLabels } from "./columnRenames";
import { renameAgentRows, renameToolOfferRows } from "./jsonRowRenames";
import { renameTaskBodies } from "./taskBodyRenames";

const LOCK_NAME = "demonstration-rename";

// The Demonstration agent was called "support guide" until 2026-10-30. At start, whatever an older version stored under
// the old name moves to the new one, in one transaction: the agent's definition with the user's settings, its tasks and
// results, its runs, schedules and records. Nothing is left to edit by hand, and a start with nothing left to move
// changes nothing, so it is safe to run on every start (the runner and the MCP server both do).
export async function renameStoredDemonstration(pool: Pool, log: (message: string) => void = console.log): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [LOCK_NAME]);

    const changes = await renameStoredDemonstrationInTransaction(client);

    await client.query("COMMIT");
    changes.filter(([, count]) => count > 0).forEach(([what, count]) => log(`demonstration rename: ${what}: ${count}`));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// The caller owns the transaction; also used by the database test, which rolls its fixture and changes back.
export async function renameStoredDemonstrationInTransaction(client: PoolClient): Promise<[string, number][]> {
  const changes: [string, number][] = [
    ["agent definitions", await renameAgentRows(client)],
    ["tool offers", await renameToolOfferRows(client)],
    ["usage records", await renameUsageLabels(client)],
  ];

  for (const rename of COLUMN_RENAMES) {
    changes.push([`${rename.table}.${rename.column}`, await renameColumn(client, rename)]);
  }
  changes.push(["task bodies", await renameTaskBodies(client)]);
  changes.push(["schedule descriptions", await renameScheduleDescriptions(client)]);

  return changes;
}

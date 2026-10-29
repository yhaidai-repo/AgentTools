import type { PoolClient } from "pg";

// The API creates its tables; a database it has not reached yet has nothing to rename there.
export async function tableExists(client: PoolClient, table: string): Promise<boolean> {
  const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS found", [table]);

  return result.rows[0].found === true;
}

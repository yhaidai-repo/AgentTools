import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PowerLoomDb } from "@powerloom/db";
import { addRunOutputs } from "./runOutputs";

const databaseUrl = process.env.POWERLOOM_ACCESS_TEST_DATABASE_URL;
it("atomically appends all concurrent outputs once, preserving original order", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/synthetic_access");
  const namespace = `outputs_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${namespace}` });
  try {
    await admin.query(`create schema ${namespace}`);
    await pool.query("create table agent_run(id bigint primary key, outputs jsonb)");
    await pool.query("insert into agent_run values (1, '[\"earlier recording\"]'), (2, null)");
    const db = drizzle(pool) as unknown as PowerLoomDb;
    await Promise.all(Array.from({ length: 30 }, (_, i) => addRunOutputs(db, 1, [`writer-${i % 10}`, "shared-output"])));
    const { rows } = await pool.query("select outputs from agent_run where id=1");
    assert.equal(rows[0].outputs[0], "earlier recording");
    assert.deepEqual([...rows[0].outputs].sort(), ["earlier recording", "shared-output", ...Array.from({ length: 10 }, (_, i) => `writer-${i}`)].sort());
    await addRunOutputs(db, 2, ["a", "a", "b"]);
    assert.deepEqual((await pool.query("select outputs from agent_run where id=2")).rows[0].outputs, ["a", "b"]);
  } finally {
    await pool.end();
    await admin.query(`drop schema if exists ${namespace} cascade`).finally(() => admin.end());
  }
});

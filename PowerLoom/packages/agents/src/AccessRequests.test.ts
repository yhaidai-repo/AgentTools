import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@powerloom/db/src/schema";
import type { PowerLoomDb } from "@powerloom/db";
import { AccessRequests } from "./AccessRequests";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";

const context: OutsideAccessContext = { vault: "demo", taskId: "AT-demo", pbiId: null, runId: 1, agentId: "synthetic", owner: "powerloom-run-1" };
const resource = { kind: "sql" as const, resource: "db", target: "synthetic" };

it("anchors a reused request with one current-row JSON update, without reading task data", async () => {
  let selects = 0;
  let predicateSql = "";
  const db = {
    select: () => { selects++; return { from: () => ({ where: async () => [{ id: "HT-alpha" }] }) }; },
    update: () => ({ set: ({ data }: { data: Parameters<PgDialect["sqlToQuery"]>[0] }) => ({ where: async () => { predicateSql = new PgDialect().sqlToQuery(data).sql; } }) }),
  } as unknown as PowerLoomDb;
  const result = await new AccessRequests(db).request(context, resource, "read_sql", "synthetic refusal");
  assert.equal(result.id, "HT-alpha");
  assert.equal(selects, 1);
  assert.match(predicateSql, /jsonb_set\(coalesce\("local_item"\."data"/);
  assert.match(predicateSql, /@> jsonb_build_array/);
});

const databaseUrl = process.env.POWERLOOM_ACCESS_TEST_DATABASE_URL;
it("retains distinct/repeated concurrent anchors and concurrent unrelated JSON updates in PostgreSQL", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/synthetic_access");
  const namespace = `access_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${namespace}` });
  try {
    await admin.query(`create schema ${namespace}`);
    await pool.query("create table local_item (id text primary key, kind text, vault text, status text, data jsonb)");
    await pool.query("insert into local_item values ('AT-demo','docs','demo','open','{\"keep\":\"original\",\"rerunAfter\":[\"HT-existing\"]}'), ('HT-alpha','human','demo','open','{\"accessRequest\":{\"kind\":\"sql\",\"resource\":\"alpha\"}}'), ('HT-bravo','human','demo','open','{\"accessRequest\":{\"kind\":\"sql\",\"resource\":\"bravo\"}}')");
    const requests = new AccessRequests(drizzle(pool, { schema }) as unknown as PowerLoomDb);
    await Promise.all([
      ...Array.from({ length: 30 }, (_, i) => requests.request(context, { ...resource, resource: i % 2 ? "alpha" : "bravo" }, "read_sql", "synthetic refusal")),
      ...Array.from({ length: 10 }, (_, i) => pool.query("update local_item set data=jsonb_set(data, array[$1], to_jsonb($2::int)) where id='AT-demo'", [`extra${i}`, i])),
    ]);
    const { rows } = await pool.query("select data from local_item where id='AT-demo'");
    assert.deepEqual([...rows[0].data.rerunAfter].sort(), ["HT-alpha", "HT-bravo", "HT-existing"]);
    assert.equal(rows[0].data.keep, "original");
    for (let i = 0; i < 10; i++) assert.equal(rows[0].data[`extra${i}`], i);
  } finally {
    await pool.end();
    await admin.query(`drop schema if exists ${namespace} cascade`).finally(() => admin.end());
  }
});

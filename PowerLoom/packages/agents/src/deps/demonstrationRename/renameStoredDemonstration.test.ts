import assert from "node:assert/strict";
import { it } from "node:test";
import { Pool } from "pg";
import { COLUMN_RENAMES } from "./columnRenames";
import { renameStoredDemonstrationInTransaction } from "./renameStoredDemonstration";

// Point only at an empty disposable database. The fixture DDL and all migrated values roll back together.
const url = process.env.DEMONSTRATION_RENAME_TEST_DATABASE_URL;
it("migrates stored references, retains history and settings, and changes nothing on a second pass", { skip: !url }, async () => {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA agent_config; CREATE SCHEMA agent_usage");
    await client.query("CREATE TABLE agent_config.agent (id text PRIMARY KEY, definition jsonb NOT NULL, updated_at timestamptz DEFAULT now())");
    await client.query("CREATE TABLE public.config (key text PRIMARY KEY, value jsonb NOT NULL)");
    await client.query("CREATE TABLE agent_usage.usage_record (labels jsonb NOT NULL)");
    await client.query("CREATE TABLE agent_usage.run_event (payload jsonb NOT NULL)");

    const tables = new Map<string, Set<string>>();
    for (const { table, column } of COLUMN_RENAMES) {
      if (!tables.has(table)) tables.set(table, new Set());
      tables.get(table)!.add(column);
    }
    for (const [table, columns] of tables) {
      await client.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, ${[...columns].map(column => `${column} text`).join(", ")})`);
    }
    await client.query("ALTER TABLE public.local_item ADD body text, ADD data jsonb; ALTER TABLE public.task_schedule ADD params jsonb");

    const definition = {
      id: "support-guide", enabled: true, schedule: "*/2 * * * *", budgets: { dailyUsd: 7 },
      capabilities: { integrations: { writeSupportGuides: false } },
      skills: ["powerloom-support-guide"], handles: ["support-guide"], prompt: "Load powerloom-support-guide.",
    };
    await client.query("INSERT INTO agent_config.agent (id, definition) VALUES ($1, $2), ('custom', $3)", [
      "support-guide", definition, { id: "custom", canAssign: ["support-guide"], description: "support-guide history" },
    ]);
    await client.query("INSERT INTO public.config VALUES ($1, $2)", ["toolsOffered:test:support-guide", { holder: "support-guide", tools: [{ name: "write_support_guide" }] }]);
    await client.query("INSERT INTO agent_usage.usage_record VALUES ($1)", [{ agent: "support-guide", vault: "test" }]);
    await client.query("INSERT INTO agent_usage.run_event VALUES ($1)", [{ agent: "support-guide", tool: "write_support_guide" }]);

    const fence = "\x60\x60\x60";
    await client.query("INSERT INTO public.local_item (id, kind, assignee, body) VALUES (1, 'support-guide', 'agent:support-guide', $1), (2, 'support-guide-result', NULL, 'support-guide history'), (3, 'research', NULL, $1)", [fence + "support-guide\n{}\n" + fence]);
    for (const [table, columns] of tables) {
      if (table === "public.local_item") continue;
      const values = [...columns].map(column => {
        const rename = COLUMN_RENAMES.find(rename => rename.table === table && rename.column === column)!;
        return rename.legacy + (rename.match === "prefix" ? "XT-1:checkpoint" : "");
      });
      await client.query(`INSERT INTO ${table} (id, ${[...columns].join(", ")}) VALUES (1, ${values.map((_, index) => `$${index + 1}`).join(", ")})`, values);
    }
    await client.query("UPDATE public.task_schedule SET params = $1", [{ description: fence + "support-guide\n{}\n" + fence, title: "Keep this title" }]);

    const changes = await renameStoredDemonstrationInTransaction(client);
    assert.ok(changes.every(([, count]) => count > 0));
    const agents = (await client.query("SELECT id, definition FROM agent_config.agent ORDER BY id")).rows;
    assert.deepEqual(agents, [
      { id: "custom", definition: { id: "custom", canAssign: ["demonstration"], description: "support-guide history" } },
      { id: "demonstration", definition: {
        ...definition, id: "demonstration", capabilities: { integrations: { writeDemonstrations: false } },
        skills: ["powerloom-demonstration"], handles: ["demonstration"], prompt: "Load powerloom-demonstration.",
      } },
    ]);
    assert.deepEqual((await client.query("SELECT * FROM public.config")).rows, [
      { key: "toolsOffered:test:demonstration", value: { holder: "demonstration", tools: [{ name: "write_demonstration" }] } },
    ]);
    assert.deepEqual((await client.query("SELECT labels FROM agent_usage.usage_record")).rows, [{ labels: { agent: "demonstration", vault: "test" } }]);
    assert.deepEqual((await client.query("SELECT payload FROM agent_usage.run_event")).rows, [{ payload: { agent: "support-guide", tool: "write_support_guide" } }]);
    assert.deepEqual((await client.query("SELECT * FROM public.local_item ORDER BY id")).rows, [
      { id: 1, kind: "demonstration", assignee: "agent:demonstration", body: fence + "demonstration\n{}\n" + fence, data: null },
      { id: 2, kind: "demonstration-result", assignee: null, body: "support-guide history", data: null },
      { id: 3, kind: "research", assignee: null, body: fence + "support-guide\n{}\n" + fence, data: null },
    ]);
    assert.deepEqual((await client.query("SELECT params FROM public.task_schedule")).rows[0].params, { description: fence + "demonstration\n{}\n" + fence, title: "Keep this title" });
    for (const [table, columns] of tables) {
      if (table === "public.local_item") continue;
      const row = (await client.query(`SELECT * FROM ${table}`)).rows[0];
      for (const column of columns) {
        const rename = COLUMN_RENAMES.find(rename => rename.table === table && rename.column === column)!;
        assert.equal(row[column], rename.renamed + (rename.match === "prefix" ? "XT-1:checkpoint" : ""));
      }
    }
    assert.ok((await renameStoredDemonstrationInTransaction(client)).every(([, count]) => count === 0));

    await client.query("SAVEPOINT collision");
    await client.query("INSERT INTO agent_config.agent (id, definition) VALUES ('support-guide', $1)", [definition]);
    await assert.rejects(renameStoredDemonstrationInTransaction(client), /both ids exist/);
    await client.query("ROLLBACK TO SAVEPOINT collision");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM agent_config.agent")).rows[0].count, 2);

    await client.query("INSERT INTO agent_config.agent (id, definition) VALUES ('powerloom-support-guide', $1)", [{ id: "powerloom-support-guide", options: { example: "support-guide" } }]);
    assert.ok((await renameStoredDemonstrationInTransaction(client)).every(([, count]) => count === 0));
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});

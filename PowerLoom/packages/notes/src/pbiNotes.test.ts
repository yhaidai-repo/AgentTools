import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { type PowerLoomDb, workItem } from "@powerloom/db";
import { BACKLOG_INDEX_PATH } from "@powerloom/vault";
import { PbiNoteWriter } from "./pbiNotes";

it("generates separate prepared-PBI indexes for two vaults and an empty vault", async () => {
  const root = await mkdtemp(join(tmpdir(), "powerloom-index-"));
  const rows = [
    { vault: "a", adoId: 1, title: "ONLY A", vaultPath: "pbis/1.md", pipelineStatus: "new", adoState: "New", iterationPath: null },
    { vault: "b", adoId: 2, title: "ONLY B", vaultPath: "pbis/2.md", pipelineStatus: "new", adoState: "New", iterationPath: null },
    { vault: "a", adoId: 3, title: "UNPREPARED", vaultPath: null, pipelineStatus: "new", adoState: "New", iterationPath: null },
  ];
  const dialect = new PgDialect();
  const db = { select: () => ({ from: () => ({ where: (predicate: Parameters<PgDialect["sqlToQuery"]>[0]) => ({ orderBy: async () => {
    const query = dialect.sqlToQuery(predicate);
    assert.match(query.sql, /"work_item"\."vault" = \$1/);
    assert.match(query.sql, /"vault_path" is not null/);
    return rows.filter(row => row.vault === query.params[0] && row.vaultPath !== null);
  } }) }) }) } as unknown as PowerLoomDb;
  try {
    for (const vault of ["a", "b", "empty"]) {
      const writer = await PbiNoteWriter.create(db, null, join(root, vault), vault);
      await writer.writeIndex();
      const text = await readFile(join(root, vault, BACKLOG_INDEX_PATH), "utf8");
      assert.equal(text.includes("ONLY A"), vault === "a");
      assert.equal(text.includes("ONLY B"), vault === "b");
      assert.equal(text.includes("UNPREPARED"), false);
      if (vault === "empty") assert.match(text, /None\./);
      await assert.rejects(writer.writePbi({ ...rows[0], vault: "foreign" } as typeof workItem.$inferSelect, "new"), /does not belong/);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

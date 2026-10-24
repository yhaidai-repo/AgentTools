import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { SqlAnswer, SqlReader } from "@powerloom/sql";
import type { AgentDeps } from "./models/AgentDeps";
import type { DataAccessEntry } from "./models/DataAccessEntry";
import { createSqlTools } from "./sqlTools";

const context = { vault: "work-projects", agentId: "research", runId: 42, owner: "powerloom-run-42", taskId: "AT-1-001", pbiId: 1 };
const agent = { capabilities: { integrations: { readSql: true } } } as unknown as AgentDefinition;
const connection = { name: "pvs", server: "sql01", database: "Pvs_Development", connectionString: "Server=sql01;Database=Pvs_Development", enabled: true };

interface Recorded {
  calls: { method: string; args: unknown[] }[];
  entries: DataAccessEntry[];
}

const oneRow: SqlAnswer = { ok: true, rows: { columns: ["a"], rows: [[1]], truncated: false, moreResultSets: 0 } };

// A reader that remembers each call, and deps whose log keeps every entry.
function fakeDeps(): { deps: AgentDeps; recorded: Recorded } {
  const recorded: Recorded = { calls: [], entries: [] };
  const remember = (method: string) => async (...args: unknown[]) => {
    recorded.calls.push({ method, args });

    return oneRow;
  };
  const reader = { query: remember("query"), listTables: remember("listTables"), describeTable: remember("describeTable"), listDatabases: remember("listDatabases") } as unknown as SqlReader;
  const log = { record: async (entry: DataAccessEntry) => { recorded.entries.push(entry); } };
  const requests = { request: async () => ({ id: "HT-1-001", created: true }) };
  const deps = { outside: { log, requests }, sql: { reader, connections: [connection] } } as unknown as AgentDeps;

  return { deps, recorded };
}

function toolNamed(deps: AgentDeps, name: string) {
  const tool = createSqlTools(deps, agent, context).find((candidate) => candidate.name === name);

  assert.ok(tool, `no tool ${name}`);

  return tool;
}

describe("createSqlTools", () => {
  it("offers the database list beside query and describe", () => {
    const { deps } = fakeDeps();

    const names = createSqlTools(deps, agent, context).map((tool) => tool.name);

    assert.deepEqual(names, ["sql_databases", "sql_query", "sql_describe"]);
  });

  it("gives nothing to an agent without the switch", () => {
    const { deps } = fakeDeps();
    const off = { capabilities: { integrations: {} } } as unknown as AgentDefinition;

    assert.deepEqual(createSqlTools(deps, off, context), []);
  });

  it("reads the connection's own database when the call names none, and logs it", async () => {
    const { deps, recorded } = fakeDeps();

    await toolNamed(deps, "sql_query").handler({ connection: "pvs", sql: "SELECT 1" });

    assert.deepEqual(recorded.calls, [{ method: "query", args: [connection.connectionString, "SELECT 1", undefined] }]);
    assert.equal(recorded.entries[0].target, "sql01/Pvs_Development");
  });

  it("reads the database the call names, and logs that one", async () => {
    const { deps, recorded } = fakeDeps();

    await toolNamed(deps, "sql_query").handler({ connection: "pvs", database: "Pvs_Stage", sql: "SELECT 1" });

    assert.deepEqual(recorded.calls, [{ method: "query", args: [connection.connectionString, "SELECT 1", "Pvs_Stage"] }]);
    assert.equal(recorded.entries[0].target, "sql01/Pvs_Stage");
  });

  it("describes tables and columns in the named database", async () => {
    const { deps, recorded } = fakeDeps();
    const describe = toolNamed(deps, "sql_describe");

    await describe.handler({ connection: "pvs", database: "Pvs_Stage" });
    await describe.handler({ connection: "pvs", database: "Pvs_Stage", table: "dbo.Verification" });

    assert.deepEqual(recorded.calls, [
      { method: "listTables", args: [connection.connectionString, "Pvs_Stage"] },
      { method: "describeTable", args: [connection.connectionString, "dbo.Verification", "Pvs_Stage"] },
    ]);
  });

  it("lists the server's databases on the connection itself", async () => {
    const { deps, recorded } = fakeDeps();

    await toolNamed(deps, "sql_databases").handler({ connection: "pvs" });

    assert.deepEqual(recorded.calls, [{ method: "listDatabases", args: [connection.connectionString] }]);
    assert.equal(recorded.entries[0].request, "list databases");
    assert.equal(recorded.entries[0].target, "sql01/Pvs_Development");
  });
});

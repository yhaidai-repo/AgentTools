import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { sqlTarget, type SqlConnectionSettings } from "@powerloom/core";
import { sqlRowsText, type SqlAnswer } from "@powerloom/sql";
import { z } from "zod";
import type { AgentDeps } from "./models/AgentDeps";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import type { OutsideResource } from "./models/OutsideResource";
import type { OutsideToolResult } from "./models/OutsideToolResult";
import type { SqlAccess } from "./models/SqlAccess";
import { defineOutsideTool } from "./outsideAccess";

export const READ_SQL_INTEGRATION = "readSql";

// The Read SQL tools (user decision 2026-10-12), for an agent with the integration switched on in its Config while its
// vault's Read SQL is on with at least one enabled connection. Read only: SqlReader refuses anything but one SELECT and
// rolls every query back. Every call goes to the data access log. A connection is per server (user decision
// 2026-10-22): sql_databases lists what its login can open, and a call names the database it reads.
export function createSqlTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[READ_SQL_INTEGRATION] === true;

  if (!isOn || !deps.sql || deps.sql.connections.length === 0) {
    return [];
  }

  const names = deps.sql.connections.map((connection) => connection.name) as [string, ...string[]];
  const connection = z.enum(names).describe(`The server to read: ${deps.sql.connections.map(connectionLabel).join("; ")}`);

  return [databasesTool(deps, context, connection), queryTool(deps, context, connection), describeTool(deps, context, connection)];
}

const databaseInput = z.string().trim().min(1).optional().describe("Another database of the connection's server, e.g. App_Stage; leave out for the connection's own. sql_databases lists them.");

function databasesTool(deps: AgentDeps, context: OutsideAccessContext, connection: z.ZodEnum<Record<string, string>>) {
  const access = deps.sql!;

  return defineOutsideTool(deps.outside, context, {
    name: "sql_databases",
    description: "List the databases a connection's login can open on its server (system databases left out), with their state. Pass one as `database` to sql_describe and sql_query, e.g. to read stage instead of dev.",
    input: { connection },
    resource: (input) => resourceOf(access, input.connection),
    request: () => "list databases",
    handler: async (input) => answerResult(await access.reader.listDatabases(connectionString(access, input.connection))),
  });
}

function queryTool(deps: AgentDeps, context: OutsideAccessContext, connection: z.ZodEnum<Record<string, string>>) {
  const access = deps.sql!;

  return defineOutsideTool(deps.outside, context, {
    name: "sql_query",
    description: "Run one read-only SQL Server query (SELECT or WITH … SELECT; T-SQL) and get the rows as a table, at most 200. Writes, EXEC, SET and several statements are refused. Find tables and columns with sql_describe first; a wrong table or column name answers with what the database has instead, so fix every name it lists before the next try.",
    input: {
      connection,
      database: databaseInput,
      sql: z.string().min(1).describe("One SELECT, e.g. SELECT TOP 20 Id, Status FROM dbo.Orders WHERE CustomerId = 42 ORDER BY CreatedAt DESC"),
    },
    resource: (input) => resourceOf(access, input.connection, input.database),
    request: (input) => input.sql,
    handler: async (input) => answerResult(await access.reader.query(connectionString(access, input.connection), input.sql, input.database)),
  });
}

function describeTool(deps: AgentDeps, context: OutsideAccessContext, connection: z.ZodEnum<Record<string, string>>) {
  const access = deps.sql!;

  return defineOutsideTool(deps.outside, context, {
    name: "sql_describe",
    description: "List a database's tables and views, or, with a table, its columns: type, max length, nullable, primary key and the column a foreign key references.",
    input: {
      connection,
      database: databaseInput,
      table: z.string().optional().describe("A table or view, e.g. dbo.Subscription; leave out to list them all"),
    },
    resource: (input) => resourceOf(access, input.connection, input.database),
    request: (input) => (input.table ? `describe ${input.table}` : "list tables"),
    handler: async (input) => {
      const target = connectionString(access, input.connection);

      if (!input.table) {
        return answerResult(await access.reader.listTables(target, input.database));
      }

      return answerResult(await access.reader.describeTable(target, input.table, input.database));
    },
  });
}

function answerResult(answer: SqlAnswer): OutsideToolResult {
  if (!answer.ok) {
    return { text: answer.message, isError: true, refusal: answer.refused ? answer.message : undefined, denied: answer.denied };
  }

  return sqlRowsText(answer.rows);
}

function resourceOf(access: SqlAccess, name: string, database?: string): OutsideResource {
  const connection = access.connections.find((entry) => entry.name === name)!;

  return { kind: "sql", resource: connection.name, target: sqlTarget(connection, database) };
}

function connectionString(access: SqlAccess, name: string): string {
  return access.connections.find((connection) => connection.name === name)!.connectionString;
}

function connectionLabel(connection: SqlConnectionSettings): string {
  return `${connection.name} (server ${connection.server}, its own database ${connection.database || "the login's default"}; other databases via sql_databases)`;
}

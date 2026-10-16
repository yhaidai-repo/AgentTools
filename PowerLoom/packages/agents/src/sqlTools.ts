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
// rolls every query back. Every call goes to the data access log.
export function createSqlTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[READ_SQL_INTEGRATION] === true;

  if (!isOn || !deps.sql || deps.sql.connections.length === 0) {
    return [];
  }

  const names = deps.sql.connections.map((connection) => connection.name) as [string, ...string[]];
  const connection = z.enum(names).describe(`The database to read: ${deps.sql.connections.map(connectionLabel).join("; ")}`);

  return [queryTool(deps, context, connection), describeTool(deps, context, connection)];
}

function queryTool(deps: AgentDeps, context: OutsideAccessContext, connection: z.ZodEnum<Record<string, string>>) {
  const access = deps.sql!;

  return defineOutsideTool(deps.outside, context, {
    name: "sql_query",
    description: "Run one read-only SQL Server query (SELECT or WITH … SELECT; T-SQL) and get the rows as a table, at most 200. Writes, EXEC, SET and several statements are refused. Find tables and columns with sql_describe first.",
    input: {
      connection,
      sql: z.string().min(1).describe("One SELECT, e.g. SELECT TOP 20 Id, Status FROM dbo.Verification WHERE PatientId = 42 ORDER BY CreatedAt DESC"),
    },
    resource: (input) => resourceOf(access, input.connection),
    request: (input) => input.sql,
    handler: async (input) => answerResult(await access.reader.query(connectionString(access, input.connection), input.sql)),
  });
}

function describeTool(deps: AgentDeps, context: OutsideAccessContext, connection: z.ZodEnum<Record<string, string>>) {
  const access = deps.sql!;

  return defineOutsideTool(deps.outside, context, {
    name: "sql_describe",
    description: "List a database's tables and views, or, with a table, its columns: type, max length, nullable, primary key and the column a foreign key references.",
    input: {
      connection,
      table: z.string().optional().describe("A table or view, e.g. dbo.Verification; leave out to list them all"),
    },
    resource: (input) => resourceOf(access, input.connection),
    request: (input) => (input.table ? `describe ${input.table}` : "list tables"),
    handler: async (input) => {
      const target = connectionString(access, input.connection);

      if (!input.table) {
        return answerResult(await access.reader.listTables(target));
      }

      return answerResult(await access.reader.describeTable(target, input.table));
    },
  });
}

function answerResult(answer: SqlAnswer): OutsideToolResult {
  if (!answer.ok) {
    return { text: answer.message, isError: true, refusal: answer.refused ? answer.message : undefined, denied: answer.denied };
  }

  return sqlRowsText(answer.rows);
}

function resourceOf(access: SqlAccess, name: string): OutsideResource {
  const connection = access.connections.find((entry) => entry.name === name)!;

  return { kind: "sql", resource: connection.name, target: sqlTarget(connection) };
}

function connectionString(access: SqlAccess, name: string): string {
  return access.connections.find((connection) => connection.name === name)!.connectionString;
}

function connectionLabel(connection: SqlConnectionSettings): string {
  return `${connection.name} (server ${connection.server}, database ${connection.database || "the login's default"})`;
}

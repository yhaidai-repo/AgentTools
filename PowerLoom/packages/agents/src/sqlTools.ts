import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import type { AgentDefinition } from "@agenttools/config";
import type { SqlConnectionSettings } from "@powerloom/core";
import { toMarkdownTable, type SqlAnswer } from "@powerloom/sql";
import { z } from "zod";
import type { AgentDeps } from "./models/AgentDeps";
import type { SqlAccess } from "./models/SqlAccess";

export const READ_SQL_INTEGRATION = "readSql";

// An answer's text is cut here so one wide result can't fill the agent's context (as for Confluence pages).
const MAX_ANSWER_CHARS = 60_000;

// The Read SQL tools (user decision 2026-10-12), for an agent with the integration switched on in its Config while its
// vault's Read SQL is on with at least one enabled connection. Read only: SqlReader refuses anything but one SELECT and
// rolls every query back.
export function createSqlTools(deps: AgentDeps, agent: AgentDefinition): ToolDefinition<any>[] {
  const isOn = agent.capabilities.integrations?.[READ_SQL_INTEGRATION] === true;

  if (!isOn || !deps.sql || deps.sql.connections.length === 0) {
    return [];
  }

  const names = deps.sql.connections.map((connection) => connection.name) as [string, ...string[]];
  const connection = z.enum(names).describe(`The database to read: ${deps.sql.connections.map(connectionLabel).join("; ")}`);

  return [queryTool(deps.sql, connection), describeTool(deps.sql, connection)];
}

function queryTool(access: SqlAccess, connection: z.ZodEnum<Record<string, string>>) {
  return defineTool({
    name: "sql_query",
    description: "Run one read-only SQL Server query (SELECT or WITH … SELECT; T-SQL) and get the rows as a table, at most 200. Writes, EXEC, SET and several statements are refused. Find tables and columns with sql_describe first.",
    input: {
      connection,
      sql: z.string().min(1).describe("One SELECT, e.g. SELECT TOP 20 Id, Status FROM dbo.Verification WHERE PatientId = 42 ORDER BY CreatedAt DESC"),
    },
    handler: async (input) => answerText(await access.reader.query(connectionString(access, input.connection), input.sql)),
  });
}

function describeTool(access: SqlAccess, connection: z.ZodEnum<Record<string, string>>) {
  return defineTool({
    name: "sql_describe",
    description: "List a database's tables and views, or, with a table, its columns: type, max length, nullable, primary key and the column a foreign key references.",
    input: {
      connection,
      table: z.string().optional().describe("A table or view, e.g. dbo.Verification; leave out to list them all"),
    },
    handler: async (input) => {
      const target = connectionString(access, input.connection);

      if (!input.table) {
        return answerText(await access.reader.listTables(target));
      }

      return columnsText(await access.reader.describeTable(target, input.table), input.table, input.connection);
    },
  });
}

// An unknown table has no columns, which reads better as a miss than as an empty table.
function columnsText(answer: SqlAnswer, table: string, connection: string) {
  if (answer.ok && answer.rows.rows.length === 0) {
    return { text: `No table or view named ${table} in ${connection}.`, isError: true };
  }

  return answerText(answer);
}

function answerText(answer: SqlAnswer) {
  if (!answer.ok) {
    return { text: answer.message, isError: true };
  }

  const { columns, rows, truncated, moreResultSets } = answer.rows;
  const notes = [truncated ? "[first 200 rows only: narrow the query]" : "", moreResultSets > 0 ? `[${moreResultSets} more result set(s) not shown: one SELECT per query]` : ""].filter(Boolean);
  const text = [`${rows.length} row(s)`, toMarkdownTable(columns, rows), ...notes].join("\n\n");
  const cut = text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: select fewer columns or rows]` : "";

  return { text: `${text.slice(0, MAX_ANSWER_CHARS)}${cut}` };
}

function connectionString(access: SqlAccess, name: string): string {
  return access.connections.find((connection) => connection.name === name)!.connectionString;
}

function connectionLabel(connection: SqlConnectionSettings): string {
  return `${connection.name} (server ${connection.server}, database ${connection.database || "the login's default"})`;
}

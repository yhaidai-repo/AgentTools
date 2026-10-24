import type { SqlRowsText } from "@powerloom/sql";
import { z } from "zod";
import type { Command } from "../models/Command";
import { runChatSqlRead } from "../readSql/runChatSqlRead";
import { sqlConnectionInput, sqlDatabaseInput, sqlVaultInput } from "../readSql/sqlCommandInputs";

export const sqlQueryCommand: Command<{ vault: string; connection: string; database?: string; sql: string }, SqlRowsText> = {
  name: "sql.query",
  effect: "read",
  description: "Run one read-only SQL Server query (SELECT or WITH … SELECT; T-SQL) on a vault's Read SQL connection and get the rows as a Markdown table, at most 200. Writes, EXEC, SET and several statements are refused. Find tables and columns with sql_describe first; a wrong table or column name answers with what the database has instead. Another database of the server goes in `database`.",
  input: z.object({
    vault: sqlVaultInput,
    connection: sqlConnectionInput,
    database: sqlDatabaseInput,
    sql: z.string().min(1).describe("One SELECT, e.g. SELECT TOP 20 Id, Status FROM dbo.Verification WHERE PatientId = 42 ORDER BY CreatedAt DESC"),
  }),
  run(context, input) {
    return runChatSqlRead(context, {
      vault: input.vault,
      connection: input.connection,
      database: input.database,
      tool: "sql.query",
      request: input.sql,
      read: (reader, target) => reader.query(target, input.sql, input.database),
    });
  },
};

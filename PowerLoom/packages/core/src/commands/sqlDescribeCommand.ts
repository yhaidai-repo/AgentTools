import type { SqlRowsText } from "@powerloom/sql";
import { z } from "zod";
import type { Command } from "../models/Command";
import { runChatSqlRead } from "../readSql/runChatSqlRead";
import { sqlConnectionInput, sqlVaultInput } from "../readSql/sqlCommandInputs";

export const sqlDescribeCommand: Command<{ vault: string; connection: string; table?: string }, SqlRowsText> = {
  name: "sql.describe",
  description: "List a vault's Read SQL database's tables and views, or, with a table, its columns: type, max length, nullable, primary key and the column a foreign key references.",
  input: z.object({
    vault: sqlVaultInput,
    connection: sqlConnectionInput,
    table: z.string().trim().min(1).optional().describe("A table or view, e.g. dbo.Verification; leave out to list them all"),
  }),
  run(context, input) {
    const table = input.table;

    if (!table) {
      return runChatSqlRead(context, { vault: input.vault, connection: input.connection, tool: "sql.describe", request: "list tables", read: (reader, target) => reader.listTables(target) });
    }

    return runChatSqlRead(context, { vault: input.vault, connection: input.connection, tool: "sql.describe", request: `describe ${table}`, read: (reader, target) => reader.describeTable(target, table) });
  },
};

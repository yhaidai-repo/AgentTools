import type { SqlRowsText } from "@powerloom/sql";
import { z } from "zod";
import type { Command } from "../models/Command";
import { runChatSqlRead } from "../readSql/runChatSqlRead";
import { sqlConnectionInput, sqlDatabaseInput, sqlVaultInput } from "../readSql/sqlCommandInputs";

export const sqlDescribeCommand: Command<{ vault: string; connection: string; database?: string; table?: string }, SqlRowsText> = {
  name: "sql.describe",
  effect: "read",
  description: "List a vault's Read SQL database's tables and views, or, with a table, its columns: type, max length, nullable, primary key and the column a foreign key references. Another database of the server goes in `database`.",
  input: z.object({
    vault: sqlVaultInput,
    connection: sqlConnectionInput,
    database: sqlDatabaseInput,
    table: z.string().trim().min(1).optional().describe("A table or view, e.g. dbo.Subscription; leave out to list them all"),
  }),
  run(context, input) {
    const table = input.table;
    const read = { vault: input.vault, connection: input.connection, database: input.database, tool: "sql.describe" };

    if (!table) {
      return runChatSqlRead(context, { ...read, request: "list tables", read: (reader, target) => reader.listTables(target, input.database) });
    }

    return runChatSqlRead(context, { ...read, request: `describe ${table}`, read: (reader, target) => reader.describeTable(target, table, input.database) });
  },
};

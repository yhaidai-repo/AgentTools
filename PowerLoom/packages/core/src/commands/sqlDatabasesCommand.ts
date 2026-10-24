import type { SqlRowsText } from "@powerloom/sql";
import { z } from "zod";
import type { Command } from "../models/Command";
import { runChatSqlRead } from "../readSql/runChatSqlRead";
import { sqlConnectionInput, sqlVaultInput } from "../readSql/sqlCommandInputs";

// A connection is per server (user decision 2026-10-22): this lists the databases its login can open, to pass as
// `database` to sql.describe and sql.query.
export const sqlDatabasesCommand: Command<{ vault: string; connection: string }, SqlRowsText> = {
  name: "sql.databases",
  effect: "read",
  description: "List the databases a vault's Read SQL connection can open on its server (system databases left out), with their state. Pass one as `database` to sql_describe and sql_query.",
  input: z.object({
    vault: sqlVaultInput,
    connection: sqlConnectionInput,
  }),
  run(context, input) {
    return runChatSqlRead(context, { vault: input.vault, connection: input.connection, tool: "sql.databases", request: "list databases", read: (reader, target) => reader.listDatabases(target) });
  },
};

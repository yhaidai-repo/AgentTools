import type { SqlAnswer, SqlReader } from "@powerloom/sql";

// One SQL read a chat asks for by command: the vault and connection it names, the database when it isn't the
// connection's own, the command (the log's tool), the request as logged, and the reader call to make.
export interface ChatSqlRead {
  vault: string;
  connection: string;
  database?: string;
  tool: string;
  request: string;
  read: (reader: SqlReader, connectionString: string) => Promise<SqlAnswer>;
}

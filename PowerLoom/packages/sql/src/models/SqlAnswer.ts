import type { SqlRows } from "./SqlRows";
import type { SqlServerError } from "./SqlServerError";

// A query's rows, or why it didn't run: an answer for the agent, never thrown. `refused` = the read-only check said no;
// `denied` = the server refused the login (the data access log tells them apart); `errorNumber` = SQL Server's error
// number when the server rejected the query (the last one's when it sent several, all in `errors`).
export type SqlAnswer =
  | { ok: true; rows: SqlRows }
  | { ok: false; message: string; refused?: boolean; denied?: boolean; errorNumber?: number; errors?: SqlServerError[] };

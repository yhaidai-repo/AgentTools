import sql from "mssql";
import { readOnlyProblem } from "./readOnlyStatement";
import { COLUMN_FACT_JOINS, KEY_SQL, REFERENCES_SQL } from "./columnFactsSql";
import { DESCRIBE_HINT } from "./wrongNameHint";
import { WrongNameLookup } from "./WrongNameLookup";
import { isWrongNameError } from "./wrongNames";
import type { SqlAnswer } from "./models/SqlAnswer";
import type { SqlConnectionCheck } from "./models/SqlConnectionCheck";
import type { SqlRows } from "./models/SqlRows";
import type { SqlServerError } from "./models/SqlServerError";

// What one query may cost (user-approved caps, 2026-10-12): rows returned, run time, and waiting on another session's
// locks. The connect timeout keeps the Settings page's Test short.
const MAX_ROWS = 200;
const QUERY_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
const LOCK_TIMEOUT_MS = 5_000;
// The reader's own catalogue lookups (a wide table's columns, every table name) aren't the agent's rows: the cap only
// guards against a runaway.
const METADATA_MAX_ROWS = 20_000;

const WHERE_AM_I = "SELECT @@SERVERNAME, DB_NAME(), CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128))";

// The databases the login can open on the server, without the system ones: a connection is per server, and the agent
// picks the database per call (user decision 2026-10-22).
const DATABASES = `SELECT name AS [database], state_desc AS [state]
FROM sys.databases
WHERE database_id > 4 AND HAS_DBACCESS(name) = 1
ORDER BY name`;

const TABLES = `SELECT s.name AS [schema], o.name AS [name], o.type_desc AS [type]
FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
ORDER BY s.name, o.name`;

const COLUMNS = `SELECT c.name AS [column], t.name AS [type], c.max_length AS [maxLength], c.is_nullable AS [nullable],
  ${KEY_SQL} AS [key], ${REFERENCES_SQL} AS [references]
FROM sys.columns c
${COLUMN_FACT_JOINS}
WHERE c.object_id = OBJECT_ID(@table)
ORDER BY c.column_id`;

// Reads SQL Server for agents (Read SQL, user decision 2026-10-12). The statement guard rejects write operations;
// rollback and read-only intent are extra precautions, not substitutes for database read-only permissions.
// One connection per call; nothing is kept between calls. `database` opens another database of the same server
// than the connection string's (the login's default when the string names none).
export class SqlReader {
  async query(connectionString: string, text: string, database?: string): Promise<SqlAnswer> {
    const problem = readOnlyProblem(text);

    if (problem) {
      return { ok: false, message: problem, refused: true };
    }

    const answer = await this.run(connectionString, text, {}, database);

    if (answer.ok || !isWrongNameError(answer.errors ?? [])) {
      return answer;
    }

    const hint = await this.namesHint(connectionString, text, answer.errors ?? [], database);

    return { ...answer, message: `${answer.message}\n\n${hint}` };
  }

  listDatabases(connectionString: string): Promise<SqlAnswer> {
    return this.run(connectionString, DATABASES, {});
  }

  listTables(connectionString: string, database?: string): Promise<SqlAnswer> {
    return this.run(connectionString, TABLES, {}, database);
  }

  // `table` as `schema.name` or `name` (the login's default schema). An unknown table has no columns, which reads better
  // as a miss than as an empty table. Every column comes back, however wide the table.
  async describeTable(connectionString: string, table: string, database?: string): Promise<SqlAnswer> {
    const answer = await this.run(connectionString, COLUMNS, { table }, database, METADATA_MAX_ROWS);

    if (answer.ok && answer.rows.rows.length === 0) {
      return { ok: false, message: `No table or view named ${table}.` };
    }

    return answer;
  }

  async check(connectionString: string): Promise<SqlConnectionCheck> {
    const answer = await this.run(connectionString, WHERE_AM_I, {});

    if (!answer.ok) {
      return answer;
    }

    const [server, database, version] = answer.rows.rows[0] ?? [];

    return { ok: true, message: `Connected: server ${server}, database ${database}, SQL Server ${version}.` };
  }

  // Best effort, on one connection: a lookup that fails leaves the plain describe hint.
  private async namesHint(connectionString: string, text: string, errors: SqlServerError[], database?: string): Promise<string> {
    let pool: sql.ConnectionPool | null = null;

    try {
      const open = await connect(connectionString, database);
      pool = open;

      return await new WrongNameLookup(async (lookup, params) => (await inRolledBackTransaction(open, lookup, params, METADATA_MAX_ROWS)).rows.rows).hint(text, errors);
    } catch {
      return DESCRIBE_HINT;
    } finally {
      await pool?.close();
    }
  }

  private async run(connectionString: string, text: string, params: Record<string, string>, database?: string, maxRows = MAX_ROWS): Promise<SqlAnswer> {
    let pool: sql.ConnectionPool | null = null;

    try {
      pool = await connect(connectionString, database);

      return await inRolledBackTransaction(pool, text, params, maxRows);
    } catch (error) {
      return failureOf(error);
    } finally {
      await pool?.close();
    }
  }
}

function connect(connectionString: string, database?: string): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool(configOf(connectionString, database)).connect();
}

// A batch with several wrong names fails with one error per name; the driver throws the last and keeps the rest in
// precedingErrors. The agent gets all of them, so it fixes every name in one retry.
export function failureOf(error: unknown): SqlAnswer {
  const errors = serverErrorsOf(error);
  const messages = errors.map((entry) => entry.message).filter((message, index, all) => all.indexOf(message) === index);
  const message = messages.length > 1 ? messages.join("\n") : (error as Error).message;

  return { ok: false, message, denied: isLoginFailure(error), errorNumber: serverErrorNumber(error), errors };
}

function serverErrorsOf(error: unknown): SqlServerError[] {
  const preceding = (error as { precedingErrors?: unknown[] }).precedingErrors ?? [];

  return [...preceding, error].flatMap(serverErrorOf);
}

function serverErrorOf(error: unknown): SqlServerError[] {
  const number = serverErrorNumber(error);

  return number === undefined ? [] : [{ number, message: (error as Error).message }];
}

// tedious names a refused login ELOGIN; everything else (a timeout, a bad query) is an ordinary failure.
function isLoginFailure(error: unknown): boolean {
  return (error as { code?: string }).code === "ELOGIN";
}

// mssql's RequestError carries SQL Server's error number; a connection or driver error has none.
function serverErrorNumber(error: unknown): number | undefined {
  const number = (error as { number?: unknown }).number;

  return typeof number === "number" ? number : undefined;
}

// The user's string with the reader's caps on top: read-only intent (a replica where the server has one), timeouts,
// one connection. A chosen database goes into the driver's config, never into the SQL text, so its name can't change
// the query.
export function configOf(connectionString: string, database?: string): sql.config {
  const parsed = sql.ConnectionPool.parseConnectionString(connectionString);
  const chosen = database?.trim();

  return {
    ...parsed,
    database: chosen || parsed.database,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    requestTimeout: QUERY_TIMEOUT_MS,
    arrayRowMode: true,
    pool: { min: 0, max: 1 },
    options: { ...parsed.options, readOnlyIntent: true },
  };
}

// READ UNCOMMITTED: an agent's read never blocks the app's writers (assumption in the design note). ROWCOUNT stops the
// server after one row more than shown, so the agent learns there were more.
async function inRolledBackTransaction(pool: sql.ConnectionPool, text: string, params: Record<string, string>, maxRows: number): Promise<{ ok: true; rows: SqlRows }> {
  const transaction = new sql.Transaction(pool);

  await transaction.begin(sql.ISOLATION_LEVEL.READ_UNCOMMITTED);

  try {
    const request = withParams(new sql.Request(transaction), params);
    const result = await request.query(`SET LOCK_TIMEOUT ${LOCK_TIMEOUT_MS}; SET ROWCOUNT ${maxRows + 1};\n${text}`);

    return { ok: true, rows: rowsOf(result, maxRows) };
  } finally {
    // A transaction the server aborted (an error inside it) is rolled back already, and its rollback call throws.
    await transaction.rollback().catch(() => undefined);
  }
}

function withParams(request: sql.Request, params: Record<string, string>): sql.Request {
  Object.entries(params).forEach(([name, value]) => request.input(name, sql.NVarChar, value));
  request.arrayRowMode = true;

  return request;
}

// In array row mode the result carries one column list per result set.
function rowsOf(result: sql.IResult<unknown>, maxRows: number): SqlRows {
  const columns = ((result as unknown as { columns?: { name: string }[][] }).columns?.[0] ?? []).map((column) => column.name);
  const rows = (result.recordsets[0] ?? []) as unknown as unknown[][];

  return { columns, rows: rows.slice(0, maxRows), truncated: rows.length > maxRows, moreResultSets: Math.max(0, result.recordsets.length - 1) };
}

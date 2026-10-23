import sql from "mssql";
import { readOnlyProblem } from "./readOnlyStatement";
import { bareName, columnsSql, DESCRIBE_HINT, groupColumns, isWrongNameError, missingTables, namedParams, namesHintText, referencedTables, sameNameSql } from "./wrongNameHint";
import type { MissingTable } from "./models/MissingTable";
import type { SqlAnswer } from "./models/SqlAnswer";
import type { SqlConnectionCheck } from "./models/SqlConnectionCheck";
import type { SqlRows } from "./models/SqlRows";

// What one query may cost (user-approved caps, 2026-10-12): rows returned, run time, and waiting on another session's
// locks. The connect timeout keeps the Settings page's Test short.
const MAX_ROWS = 200;
const QUERY_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
const LOCK_TIMEOUT_MS = 5_000;

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
  CASE WHEN pk.column_id IS NULL THEN '' ELSE 'PK' END AS [key],
  ISNULL(OBJECT_SCHEMA_NAME(fk.referenced_object_id) + '.' + OBJECT_NAME(fk.referenced_object_id) + '.' + COL_NAME(fk.referenced_object_id, fk.referenced_column_id), '') AS [references]
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN (SELECT ic.object_id, ic.column_id FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id WHERE i.is_primary_key = 1) pk
  ON pk.object_id = c.object_id AND pk.column_id = c.column_id
LEFT JOIN sys.foreign_key_columns fk ON fk.parent_object_id = c.object_id AND fk.parent_column_id = c.column_id
WHERE c.object_id = OBJECT_ID(@table)
ORDER BY c.column_id`;

// Reads SQL Server for agents (Read SQL, user decision 2026-10-12). Read only twice: the statement check refuses
// anything but one SELECT, and every query runs in a transaction that is rolled back, so even a write login changes
// nothing. One connection per call; nothing is kept between calls. `database` opens another database of the same server
// than the connection string's (the login's default when the string names none).
export class SqlReader {
  async query(connectionString: string, text: string, database?: string): Promise<SqlAnswer> {
    const problem = readOnlyProblem(text);

    if (problem) {
      return { ok: false, message: problem, refused: true };
    }

    const answer = await this.run(connectionString, text, {}, database);

    if (answer.ok || !isWrongNameError(answer.errorNumber)) {
      return answer;
    }

    const hint = await this.namesHint(connectionString, text, database);

    return { ...answer, message: `${answer.message}\n\n${hint}` };
  }

  listDatabases(connectionString: string): Promise<SqlAnswer> {
    return this.run(connectionString, DATABASES, {});
  }

  listTables(connectionString: string, database?: string): Promise<SqlAnswer> {
    return this.run(connectionString, TABLES, {}, database);
  }

  // `table` as `schema.name` or `name` (the login's default schema). An unknown table has no columns, which reads better
  // as a miss than as an empty table.
  async describeTable(connectionString: string, table: string, database?: string): Promise<SqlAnswer> {
    const answer = await this.run(connectionString, COLUMNS, { table }, database);

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

  // Best effort: a lookup that fails leaves the plain describe hint.
  private async namesHint(connectionString: string, text: string, database?: string): Promise<string> {
    const tables = referencedTables(text);

    if (tables.length === 0) {
      return DESCRIBE_HINT;
    }

    const answer = await this.run(connectionString, columnsSql(tables.length), namedParams("t", tables), database);

    if (!answer.ok) {
      return DESCRIBE_HINT;
    }

    const found = groupColumns(tables, answer.rows.rows);
    const unknown = tables.filter((table) => !found.some((entry) => entry.table === table));
    const missing = await this.missingTables(connectionString, unknown, database);

    return namesHintText(found, missing);
  }

  private async missingTables(connectionString: string, tables: string[], database?: string): Promise<MissingTable[]> {
    if (tables.length === 0) {
      return [];
    }

    const answer = await this.run(connectionString, sameNameSql(tables.length), namedParams("n", tables.map(bareName)), database);

    return missingTables(tables, answer.ok ? answer.rows.rows : []);
  }

  private async run(connectionString: string, text: string, params: Record<string, string>, database?: string): Promise<SqlAnswer> {
    let pool: sql.ConnectionPool | null = null;

    try {
      pool = await new sql.ConnectionPool(configOf(connectionString, database)).connect();

      return await inRolledBackTransaction(pool, text, params);
    } catch (error) {
      return { ok: false, message: (error as Error).message, denied: isLoginFailure(error), errorNumber: serverErrorNumber(error) };
    } finally {
      await pool?.close();
    }
  }
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
async function inRolledBackTransaction(pool: sql.ConnectionPool, text: string, params: Record<string, string>): Promise<SqlAnswer> {
  const transaction = new sql.Transaction(pool);

  await transaction.begin(sql.ISOLATION_LEVEL.READ_UNCOMMITTED);

  try {
    const request = withParams(new sql.Request(transaction), params);
    const result = await request.query(`SET LOCK_TIMEOUT ${LOCK_TIMEOUT_MS}; SET ROWCOUNT ${MAX_ROWS + 1};\n${text}`);

    return { ok: true, rows: rowsOf(result) };
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
function rowsOf(result: sql.IResult<unknown>): SqlRows {
  const columns = ((result as unknown as { columns?: { name: string }[][] }).columns?.[0] ?? []).map((column) => column.name);
  const rows = (result.recordsets[0] ?? []) as unknown as unknown[][];

  return { columns, rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS, moreResultSets: Math.max(0, result.recordsets.length - 1) };
}

// Words a read-only query never needs. Writes, schema changes, procedures, outside data sources, the session and
// transaction statements that could lift the reader's caps (ROWCOUNT, isolation) or end its rolled-back transaction,
// and the table hints that hold locks until the rollback, so a query could block the app's writers for its 30 s.
const FORBIDDEN = new Set([
  "INSERT", "UPDATE", "DELETE", "MERGE", "INTO", "TRUNCATE", "BULK",
  "CREATE", "ALTER", "DROP", "GRANT", "DENY", "REVOKE",
  "EXEC", "EXECUTE", "DBCC", "RECONFIGURE", "SHUTDOWN", "KILL", "BACKUP", "RESTORE",
  "OPENROWSET", "OPENQUERY", "OPENDATASOURCE",
  "SET", "USE", "WAITFOR", "BEGIN", "COMMIT", "ROLLBACK", "SAVE", "TRAN", "TRANSACTION",
  "TABLOCK", "TABLOCKX", "XLOCK", "UPDLOCK", "HOLDLOCK", "PAGLOCK", "SERIALIZABLE", "REPEATABLEREAD", "READCOMMITTEDLOCK",
]);

// A sequence moves on even when the transaction is rolled back: the one lasting change a plain SELECT can make.
const NEXT_SEQUENCE_VALUE = /\bNEXT\s+VALUE\s+FOR\b/i;

// String literals, quoted names and comments, blanked before the check so a word inside them doesn't count. An
// unclosed one stays and is checked, so a mistake makes the check stricter, never looser.
const LITERALS = /'(?:[^']|'')*'|\[(?:[^\]]|\]\])*\]|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;

const NOT_A_WORD = /[^A-Za-z0-9_@#$]+/;

// Why the text may not run, or null for one SELECT (or WITH … SELECT) statement without a forbidden word. A second line
// of defence: the reader also runs every query in a transaction it rolls back.
export function readOnlyProblem(sql: string): string | null {
  const code = sql.replace(LITERALS, " ").trim().replace(/;\s*$/, "");

  if (code.length === 0) {
    return "The query is empty.";
  }

  if (code.includes(";")) {
    return "One statement per query: remove the ';' between statements.";
  }

  if (!/^(SELECT|WITH)\b/i.test(code)) {
    return "Only a SELECT (or WITH … SELECT) query may run.";
  }

  if (NEXT_SEQUENCE_VALUE.test(code)) {
    return "Read only: NEXT VALUE FOR advances a sequence, and a rollback doesn't undo that; read sys.sequences instead.";
  }

  const word = code.split(NOT_A_WORD).find((token) => FORBIDDEN.has(token.toUpperCase()));

  return word ? `Read only: ${word.toUpperCase()} isn't allowed in a query (a column or table with that name goes in brackets, e.g. [${word}]).` : null;
}

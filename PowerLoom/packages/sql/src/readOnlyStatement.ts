// Words a read-only query never needs. Writes, schema changes, procedures, outside data sources, and the session and
// transaction statements that could lift the reader's caps (ROWCOUNT, isolation) or end its rolled-back transaction.
const FORBIDDEN = new Set([
  "INSERT", "UPDATE", "DELETE", "MERGE", "INTO", "TRUNCATE", "BULK",
  "CREATE", "ALTER", "DROP", "GRANT", "DENY", "REVOKE",
  "EXEC", "EXECUTE", "DBCC", "RECONFIGURE", "SHUTDOWN", "KILL", "BACKUP", "RESTORE",
  "OPENROWSET", "OPENQUERY", "OPENDATASOURCE",
  "SET", "USE", "WAITFOR", "BEGIN", "COMMIT", "ROLLBACK", "SAVE", "TRAN", "TRANSACTION",
]);

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

  const word = code.split(NOT_A_WORD).find((token) => FORBIDDEN.has(token.toUpperCase()));

  return word ? `Read only: ${word.toUpperCase()} isn't allowed in a query (a column or table with that name goes in brackets, e.g. [${word}]).` : null;
}

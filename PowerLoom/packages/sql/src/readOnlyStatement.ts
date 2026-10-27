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

const NOT_A_WORD = /[^A-Za-z0-9_@#$]+/;

// Why the text may not run, or null for one SELECT (or WITH … SELECT) statement without a forbidden word.
// Rollback and read-only intent are additional precautions, not write authorization.
export function readOnlyProblem(sql: string): string | null {
  const executable = executableText(sql);
  if (executable === null) {
    return "Malformed SQL: close every string, quoted identifier and block comment, and remove unmatched comment endings.";
  }
  const code = executable.trim().replace(/;\s*$/, "");

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

// T-SQL block comments nest. Quotes inside a comment have no special meaning; comments inside a quoted value
// or name have none either. Scan in order so neither can conceal executable text after the other's true ending.
function executableText(sql: string): string | null {
  const code: string[] = [];
  let i = 0;
  while (i < sql.length) {
    const pair = sql.slice(i, i + 2);
    if (pair === "--") {
      i += 2;
      while (i < sql.length && sql[i] !== "\r" && sql[i] !== "\n") i++;
      code.push(" ");
    } else if (pair === "/*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        const next = sql.slice(i, i + 2);
        if (next === "/*" || next === "*/") {
          depth += next === "/*" ? 1 : -1;
          i += 2;
        } else {
          i++;
        }
      }
      if (depth !== 0) return null;
      code.push(" ");
    } else if (pair === "*/") {
      return null;
    } else if (sql[i] === "'" || sql[i] === '"' || sql[i] === "[") {
      const end = sql[i] === "[" ? "]" : sql[i];
      let closed = false;
      i++;
      while (i < sql.length) {
        if (sql[i++] !== end) continue;
        if (sql[i] === end) {
          i++;
        } else {
          closed = true;
          break;
        }
      }
      if (!closed) return null;
      code.push(" ");
    } else {
      code.push(sql[i++]);
    }
  }
  return code.join("");
}

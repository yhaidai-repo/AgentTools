import type { MissingTable } from "./models/MissingTable";
import type { TableColumns } from "./models/TableColumns";

// SQL Server's "Invalid column name" and "Invalid object name". Agents guess names from the C# entities, and the
// mappings rename them (Facility.Id is FacilityId, Tenant lives in the membership schema), so a miss answers with the
// names the database really has instead of a bare error the agent retries blind.
const WRONG_NAME_ERRORS = new Set([207, 208]);
const MAX_TABLES = 5;
const NAME_PART = String.raw`(?:\[[^\]]+\]|\w+)`;
const TABLE_AFTER_FROM_OR_JOIN = new RegExp(String.raw`\b(?:FROM|JOIN)\s+(${NAME_PART}(?:\s*\.\s*${NAME_PART}){0,2})`, "gi");
const CTE_NAME = /(?:\bWITH|,)\s*(\w+)\s*(?:\([^)]*\)\s*)?AS\s*\(/gi;

export const DESCRIBE_HINT = "Describe a table for its column types and keys, or list the tables to find one.";

export function isWrongNameError(errorNumber: number | undefined): boolean {
  return errorNumber !== undefined && WRONG_NAME_ERRORS.has(errorNumber);
}

// The tables and views after FROM and JOIN, as written, without the query's own CTEs.
export function referencedTables(text: string): string[] {
  const cteNames = new Set([...text.matchAll(CTE_NAME)].map((match) => match[1].toLowerCase()));
  const written = [...text.matchAll(TABLE_AFTER_FROM_OR_JOIN)].map((match) => match[1].replace(/\s+/g, ""));
  const tables = written.filter((table) => !cteNames.has(bareName(table).toLowerCase()));

  return uniqueIgnoringCase(tables).slice(0, MAX_TABLES);
}

export function bareName(table: string): string {
  const parts = table.split(".");

  return parts[parts.length - 1].replace(/^\[|\]$/g, "");
}

// OBJECT_ID resolves each name the way the failed query did (the login's default schema when none is written).
export function columnsSql(tableCount: number): string {
  const references = numbered(tableCount, (index) => `(${index}, @t${index})`);

  return `SELECT r.ref, c.name FROM (VALUES ${references}) AS r(i, ref)
JOIN sys.columns c ON c.object_id = OBJECT_ID(r.ref)
ORDER BY r.i, c.column_id`;
}

export function sameNameSql(nameCount: number): string {
  const names = numbered(nameCount, (index) => `@n${index}`);

  return `SELECT o.name, s.name + '.' + o.name FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0 AND o.name IN (${names})
ORDER BY s.name`;
}

export function namedParams(prefix: string, values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((value, index) => [`${prefix}${index}`, value]));
}

// `rows` from columnsSql: [table as written, column].
export function groupColumns(tables: string[], rows: unknown[][]): TableColumns[] {
  const columnsOf = (table: string) => rows.filter(([written]) => written === table).map(([, column]) => String(column));

  return tables.map((table) => ({ table, columns: columnsOf(table) })).filter((entry) => entry.columns.length > 0);
}

// `rows` from sameNameSql: [bare name, schema.name].
export function missingTables(tables: string[], rows: unknown[][]): MissingTable[] {
  const sameNameAs = (table: string) => rows.filter(([name]) => sameIgnoringCase(String(name), bareName(table))).map(([, full]) => String(full));

  return tables.map((table) => ({ table, sameName: sameNameAs(table) }));
}

export function namesHintText(found: TableColumns[], missing: MissingTable[]): string {
  const lines = [...found.map(columnsLine), ...missing.map(missingLine)];

  return ["Names in this query, as the database has them:", ...lines, DESCRIBE_HINT].join("\n");
}

function columnsLine(entry: TableColumns): string {
  return `- ${entry.table}: ${entry.columns.join(", ")}`;
}

function missingLine(entry: MissingTable): string {
  if (entry.sameName.length === 0) {
    return `- ${entry.table}: no such table or view`;
  }

  return `- ${entry.table}: no such table or view; same name in ${entry.sameName.join(", ")}`;
}

function numbered(count: number, item: (index: number) => string): string {
  return Array.from({ length: count }, (_, index) => item(index)).join(", ");
}

function uniqueIgnoringCase(values: string[]): string[] {
  return values.filter((value, index) => values.findIndex((other) => sameIgnoringCase(other, value)) === index);
}

function sameIgnoringCase(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

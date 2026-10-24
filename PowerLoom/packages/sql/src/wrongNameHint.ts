import { COLUMN_FACT_JOINS, KEY_SQL, REFERENCES_SQL } from "./columnFactsSql";
import { closestNames } from "./closestNames";
import { bareName, sameIgnoringCase } from "./queryTables";
import type { ColumnElsewhere } from "./models/ColumnElsewhere";
import type { MissingTable } from "./models/MissingTable";
import type { TableColumns } from "./models/TableColumns";

export const DESCRIBE_HINT = "Describe a table for all its column details, or list the tables to find one.";

// OBJECT_ID resolves each name the way the failed query did (the login's default schema when none is written).
export function columnsSql(tableCount: number): string {
  const references = numbered(tableCount, (index) => `(${index}, @t${index})`);

  return `SELECT r.ref, c.name, t.name, ${KEY_SQL}, ${REFERENCES_SQL}
FROM (VALUES ${references}) AS r(i, ref)
JOIN sys.columns c ON c.object_id = OBJECT_ID(r.ref)
${COLUMN_FACT_JOINS}
ORDER BY r.i, c.column_id`;
}

// Every table and view as schema.name: a missing table's same-name and close matches come from here.
export const TABLE_NAMES_SQL = `SELECT s.name + '.' + o.name FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
ORDER BY s.name, o.name`;

// The tables and views that have a column of each name (the collation decides case, as in the failed query).
export function columnHomesSql(nameCount: number): string {
  const names = numbered(nameCount, (index) => `@c${index}`);

  return `SELECT c.name, s.name + '.' + o.name FROM sys.columns c
JOIN sys.objects o ON o.object_id = c.object_id JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0 AND c.name IN (${names})
ORDER BY s.name, o.name`;
}

export function namedParams(prefix: string, values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((value, index) => [`${prefix}${index}`, value]));
}

// `rows` from columnsSql: [table as written, column, type, key, references]. A column with two foreign keys comes
// back twice; the first row stays.
export function groupColumns(tables: string[], rows: unknown[][]): TableColumns[] {
  const columnsOf = (table: string) => rows.filter(([written]) => written === table).map(([, name, type, key, references]) => ({ name: String(name), type: String(type), key: String(key ?? ""), references: String(references ?? "") }));
  const unique = (table: string) => columnsOf(table).filter((column, index, all) => all.findIndex((other) => other.name === column.name) === index);

  return tables.map((table) => ({ table, columns: unique(table) })).filter((entry) => entry.columns.length > 0);
}

// `names` from TABLE_NAMES_SQL.
export function missingTables(tables: string[], names: string[]): MissingTable[] {
  const sameNameAs = (table: string) => names.filter((name) => sameIgnoringCase(bareName(name), bareName(table)));
  const closestTo = (table: string) => closestNames(table, names.filter((name) => !sameIgnoringCase(bareName(name), bareName(table))));

  return tables.map((table) => ({ table, sameName: sameNameAs(table), closest: closestTo(table) }));
}

// `rows` from columnHomesSql: [column, schema.table].
export function columnsElsewhere(columns: string[], rows: unknown[][]): ColumnElsewhere[] {
  const homesOf = (column: string) => rows.filter(([name]) => sameIgnoringCase(String(name), column)).map(([, table]) => String(table));

  return columns.map((column) => ({ column, tables: homesOf(column) }));
}

function numbered(count: number, item: (index: number) => string): string {
  return Array.from({ length: count }, (_, index) => item(index)).join(", ");
}

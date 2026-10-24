import { bareName, NAME_PART, sameIgnoringCase, sameTable, unbracketed } from "./queryTables";
import type { TableAlias } from "./models/TableAlias";
import type { TableColumns } from "./models/TableColumns";
import type { WrongName } from "./models/WrongName";

// The query's alias.column references the looked-up tables don't have. SQL Server names one kind of problem per try
// (a missing table stops it before any column), so the hint checks every qualified column at once.
export function unknownQualifiedColumns(text: string, aliases: TableAlias[], found: TableColumns[]): WrongName[] {
  const names = found.flatMap((entry) => qualifiersOf(entry.table, aliases).flatMap((qualifier) => unknownColumns(text, qualifier, entry)));

  return names.filter((name, index) => names.findIndex((other) => sameIgnoringCase(other.name, name.name)) === index);
}

// The server's wrong names first, without a bare column the query check already names with its qualifier.
export function mergedWrongNames(server: WrongName[], checked: WrongName[]): WrongName[] {
  const checkedColumn = (name: WrongName) => checked.some((other) => sameIgnoringCase(other.name.split(".").pop() ?? "", name.name));
  const kept = server.filter((name) => name.kind !== "column" || !checkedColumn(name));
  const added = checked.filter((name) => !server.some((other) => sameIgnoringCase(other.name, name.name)));

  return [...kept, ...added];
}

// A table is written by its alias, or by its own name when it has none.
function qualifiersOf(table: string, aliases: TableAlias[]): string[] {
  const entries = aliases.filter((entry) => sameTable(entry.table, table));

  return entries.map((entry) => entry.alias || bareName(entry.table));
}

function unknownColumns(text: string, qualifier: string, entry: TableColumns): WrongName[] {
  const escaped = qualifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reference = new RegExp(String.raw`(?<![\w.\]])(?:\[${escaped}\]|${escaped})\s*\.\s*(${NAME_PART})`, "gi");
  const columns = [...text.matchAll(reference)].map((match) => unbracketed(match[1]));
  const unknown = columns.filter((column) => !entry.columns.some((candidate) => sameIgnoringCase(candidate.name, column)));

  return unknown.map((column) => ({ kind: "column", name: `${qualifier}.${column}` }));
}

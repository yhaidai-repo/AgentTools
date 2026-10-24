import type { TableAlias } from "./models/TableAlias";
import type { WrongName } from "./models/WrongName";

const MAX_TABLES = 5;
export const NAME_PART = String.raw`(?:\[[^\]]+\]|\w+)`;
const TABLE_NAME = String.raw`${NAME_PART}(?:\s*\.\s*${NAME_PART}){0,2}`;
// Words that can follow a table and aren't its alias; the lookahead keeps them for the next FROM or JOIN match.
const NOT_AN_ALIAS = String.raw`(?:ON|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|OUTER|GROUP|ORDER|HAVING|UNION|EXCEPT|INTERSECT|WITH|FOR|OPTION|PIVOT|UNPIVOT|TABLESAMPLE)\b`;
const TABLE_AFTER_FROM_OR_JOIN = new RegExp(String.raw`\b(?:FROM|JOIN)\s+(${TABLE_NAME})(?:\s+(?:AS\s+)?(?!${NOT_AN_ALIAS})(${NAME_PART}))?`, "gi");
const CTE_NAME = /(?:\bWITH|,)\s*(\w+)\s*(?:\([^)]*\)\s*)?AS\s*\(/gi;
// A string literal ('it''s' included) or a comment: text, not names.
const NOT_CODE = /'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//g;

// The query without its string literals and comments, so `WHERE note = 'from v.Nope'` names nothing.
export function sqlCode(text: string): string {
  return text.replace(NOT_CODE, (match) => (match.startsWith("'") ? "''" : " "));
}

// The tables and views after FROM and JOIN, as written, with their aliases, without the query's own CTEs.
export function tableAliases(query: string): TableAlias[] {
  const text = sqlCode(query);
  const cteNames = new Set([...text.matchAll(CTE_NAME)].map((match) => match[1].toLowerCase()));
  const written = [...text.matchAll(TABLE_AFTER_FROM_OR_JOIN)].map((match) => ({ table: match[1].replace(/\s+/g, ""), alias: unbracketed(match[2] ?? "") }));

  return written.filter((entry) => !cteNames.has(bareName(entry.table).toLowerCase()));
}

// The tables to look up: the ones the server called wrong first, then the rest of the query's, each once.
export function queriedTables(aliases: TableAlias[], wrong: WrongName[]): string[] {
  const wrongTables = wrong.filter((name) => name.kind === "table").map((name) => name.name);
  const tables = [...wrongTables, ...aliases.map((entry) => entry.table)];

  return tables.filter((table, index) => tables.findIndex((other) => sameTable(other, table)) === index).slice(0, MAX_TABLES);
}

export function referencedTables(text: string): string[] {
  return queriedTables(tableAliases(text), []);
}

export function bareName(table: string): string {
  const parts = table.split(".");

  return unbracketed(parts[parts.length - 1]);
}

export function sameIgnoringCase(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function sameTable(left: string, right: string): boolean {
  return sameIgnoringCase(left.replace(/[[\]]/g, ""), right.replace(/[[\]]/g, ""));
}

export function unbracketed(name: string): string {
  return name.replace(/^\[|\]$/g, "");
}

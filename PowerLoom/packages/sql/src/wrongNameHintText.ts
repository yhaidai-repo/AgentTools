import { closestNames } from "./closestNames";
import { bareName, sameIgnoringCase, sameTable } from "./queryTables";
import { DESCRIBE_HINT } from "./wrongNameHint";
import { qualifiedParts } from "./wrongNames";
import type { MissingTable } from "./models/MissingTable";
import type { TableAlias } from "./models/TableAlias";
import type { TableColumn } from "./models/TableColumn";
import type { TableColumns } from "./models/TableColumns";
import type { WrongName } from "./models/WrongName";
import type { WrongNameFacts } from "./models/WrongNameFacts";

const MAX_HOMES = 5;
const MAX_SUGGESTIONS = 3;

// The hint under a wrong-name error: each wrong name with what the database has instead, then the query's tables as
// sql_describe would give them, so the agent fixes every name in one retry instead of guessing one per error.
export function namesHintText(facts: WrongNameFacts): string {
  const wrongLines = facts.wrong.flatMap((name) => wrongNameLine(name, facts));
  const tableLines = [...facts.found.map((entry) => columnsLine(entry, facts.aliases)), ...facts.missing.map(missingLine)];
  const sections = [
    ...(wrongLines.length > 0 ? ["Wrong names:", ...wrongLines] : []),
    ...(tableLines.length > 0 ? ["Columns of this query's tables, as the database has them:", ...tableLines] : []),
  ];

  return [...sections, DESCRIBE_HINT].join("\n");
}

function wrongNameLine(name: WrongName, facts: WrongNameFacts): string[] {
  const explain: Record<WrongName["kind"], () => string | undefined> = {
    column: () => columnText(name.name, facts),
    ambiguous: () => ambiguousText(name.name, facts),
    unbound: () => unboundText(name.name, facts),
    table: () => undefined,
  };
  const text = explain[name.kind]();

  return text ? [`- ${name.name}: ${text}`] : [];
}

// Invalid column name: in another of the query's tables than the one it's written with, or not in them at all.
function columnText(name: string, facts: WrongNameFacts): string {
  const [qualifier, column] = qualifiedParts(name);
  const holders = tablesWith(column, facts);

  if (holders.length > 0) {
    return `it's a column of ${holders.join(", ")}: check which table's alias it's written with`;
  }

  return elsewhereText(column, qualifier, facts);
}

function ambiguousText(column: string, facts: WrongNameFacts): string {
  const holders = tablesWith(column, facts);

  return `it's in ${holders.length > 1 ? holders.join(", ") : "more than one of this query's tables"}: write it with the alias of the one you mean`;
}

// A multi-part identifier that could not be bound: the qualifier is the problem; say where the column really is.
function unboundText(name: string, facts: WrongNameFacts): string {
  const [qualifier, column] = qualifiedParts(name);
  const holders = tablesWith(column, facts);
  const where = holders.length > 0 ? `${column} is in ${holders.join(", ")}` : elsewhereText(column, "", facts);

  return `${qualifierText(qualifier, column, facts.aliases)}; ${where}`;
}

function qualifierText(qualifier: string, column: string, aliases: TableAlias[]): string {
  const aliased = aliases.find((entry) => entry.alias !== "" && sameIgnoringCase(entry.alias, qualifier));

  if (aliased) {
    return `${qualifier} is the alias of ${aliased.table}, but not where it's used (an alias inside a subquery stays there; a JOIN's alias starts at its JOIN)`;
  }

  const renamed = aliases.find((entry) => entry.alias !== "" && sameIgnoringCase(bareName(entry.table), bareName(qualifier)));

  if (renamed) {
    return `${renamed.table} has the alias ${renamed.alias} in this query: write ${renamed.alias}.${column}`;
  }

  const known = aliases.map((entry) => tableLabel(entry.table, aliases));

  return `${qualifier} is no table or alias of this query's FROM or JOIN${known.length > 0 ? ` (${unique(known).join(", ")})` : ""}`;
}

// A qualified column is looked for in its own table; a bare one in all the query's tables.
function elsewhereText(column: string, qualifier: string, facts: WrongNameFacts): string {
  const own = facts.found.find((entry) => qualifier !== "" && isWrittenAs(entry.table, qualifier, facts.aliases));
  const closest = suggestions(column, own ? [own] : facts.found, facts.aliases);
  const notIn = own ? `not in ${tableLabel(own.table, facts.aliases)}` : "not in this query's tables";
  const homes = facts.elsewhere.find((entry) => sameIgnoringCase(entry.column, column))?.tables;

  return [closest.length > 0 ? `${notIn}; closest: ${closest.join(", ")}` : notIn, homesText(homes)].filter((text) => text !== "").join("; ");
}

// An `Id` is the entity's key, which the mappings rename (Facility.Id is FacilityId): the primary key comes first.
function suggestions(column: string, tables: TableColumns[], aliases: TableAlias[]): string[] {
  const keys = sameIgnoringCase(column, "Id") ? tables.flatMap((entry) => columnLabels(entry, aliases, (candidate) => candidate.key === "PK")) : [];
  const closest = closestNames(column, tables.flatMap((entry) => columnLabels(entry, aliases)));

  return unique([...keys, ...closest]).slice(0, MAX_SUGGESTIONS);
}

function isWrittenAs(table: string, qualifier: string, aliases: TableAlias[]): boolean {
  return aliasesOf(table, aliases).some((alias) => sameIgnoringCase(alias, qualifier)) || sameIgnoringCase(bareName(table), bareName(qualifier));
}

function homesText(homes: string[] | undefined): string {
  if (homes === undefined) {
    return "";
  }

  if (homes.length === 0) {
    return "no table or view of this database has a column of that name";
  }

  const more = homes.length > MAX_HOMES ? ` and ${homes.length - MAX_HOMES} more` : "";

  return `a column of that name is in ${homes.slice(0, MAX_HOMES).join(", ")}${more}`;
}

function tablesWith(column: string, facts: WrongNameFacts): string[] {
  const holders = facts.found.filter((entry) => entry.columns.some((candidate) => sameIgnoringCase(candidate.name, column)));

  return holders.map((entry) => tableLabel(entry.table, facts.aliases));
}

// How the agent writes a column of the table in this query: by its alias when it has one.
function columnLabels(entry: TableColumns, aliases: TableAlias[], keep: (column: TableColumn) => boolean = () => true): string[] {
  const prefix = aliasesOf(entry.table, aliases)[0] ?? entry.table;

  return entry.columns.filter(keep).map((column) => `${prefix}.${column.name}`);
}

function columnsLine(entry: TableColumns, aliases: TableAlias[]): string {
  return `- ${tableLabel(entry.table, aliases)}: ${entry.columns.map(columnFacts).join(", ")}`;
}

function columnFacts(column: TableColumn): string {
  const references = column.references !== "" ? `FK ${column.references}` : "";

  return [column.name, column.type, column.key, references].filter((part) => part !== "").join(" ");
}

function missingLine(entry: MissingTable): string {
  const sameName = entry.sameName.length > 0 ? `same name in ${entry.sameName.join(", ")}` : "";
  const closest = entry.closest.length > 0 ? `closest: ${entry.closest.join(", ")}` : "";

  return `- ${entry.table}: ${["no such table or view", sameName, closest].filter((part) => part !== "").join("; ")}`;
}

function tableLabel(table: string, aliases: TableAlias[]): string {
  const names = aliasesOf(table, aliases);

  return names.length > 0 ? `${table} AS ${names.join("/")}` : table;
}

function aliasesOf(table: string, aliases: TableAlias[]): string[] {
  return unique(aliases.filter((entry) => entry.alias !== "" && sameTable(entry.table, table)).map((entry) => entry.alias));
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

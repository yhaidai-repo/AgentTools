import { mergedWrongNames, unknownQualifiedColumns } from "./qualifiedColumns";
import { queriedTables, sameIgnoringCase, tableAliases } from "./queryTables";
import { columnHomesSql, columnsElsewhere, columnsSql, groupColumns, missingTables, namedParams, TABLE_NAMES_SQL } from "./wrongNameHint";
import { namesHintText } from "./wrongNameHintText";
import { qualifiedParts, wrongNamesOf } from "./wrongNames";
import type { ColumnElsewhere } from "./models/ColumnElsewhere";
import type { MetadataRows } from "./models/MetadataRows";
import type { MissingTable } from "./models/MissingTable";
import type { SqlServerError } from "./models/SqlServerError";
import type { TableColumns } from "./models/TableColumns";
import type { WrongName } from "./models/WrongName";

const MAX_COLUMNS_LOOKED_UP = 10;

// Asks the database what a failed query's names should have been: the query's tables with their columns, where a
// missing table lives, and which tables have a wrong column the query's tables lack.
export class WrongNameLookup {
  constructor(private readonly rows: MetadataRows) {}

  async hint(text: string, errors: SqlServerError[]): Promise<string> {
    const server = wrongNamesOf(errors);
    const aliases = tableAliases(text);
    const tables = queriedTables(aliases, server);
    const found = await this.columnsOf(tables);
    const wrong = mergedWrongNames(server, unknownQualifiedColumns(text, aliases, found));
    const missing = await this.missingOf(tables.filter((table) => !found.some((entry) => entry.table === table)));
    const elsewhere = await this.elsewhereOf(unplacedColumns(wrong, found));

    return namesHintText({ wrong, aliases, found, missing, elsewhere });
  }

  private async columnsOf(tables: string[]): Promise<TableColumns[]> {
    if (tables.length === 0) {
      return [];
    }

    return groupColumns(tables, await this.rows(columnsSql(tables.length), namedParams("t", tables)));
  }

  private async missingOf(tables: string[]): Promise<MissingTable[]> {
    if (tables.length === 0) {
      return [];
    }

    const names = (await this.rows(TABLE_NAMES_SQL, {})).map(([name]) => String(name));

    return missingTables(tables, names);
  }

  private async elsewhereOf(columns: string[]): Promise<ColumnElsewhere[]> {
    if (columns.length === 0) {
      return [];
    }

    return columnsElsewhere(columns, await this.rows(columnHomesSql(columns.length), namedParams("c", columns)));
  }
}

// The wrong columns none of the query's tables has: only the rest of the database can say where they are. Not an
// `Id`: nearly every table has one, and its own table's key is the answer.
function unplacedColumns(wrong: WrongName[], found: TableColumns[]): string[] {
  const named = wrong.filter((name) => name.kind === "column" || name.kind === "unbound").map((name) => qualifiedParts(name.name)[1]);
  const columns = named.filter((column) => !sameIgnoringCase(column, "Id"));
  const isPlaced = (column: string) => found.some((entry) => entry.columns.some((candidate) => sameIgnoringCase(candidate.name, column)));
  const unplaced = columns.filter((column) => !isPlaced(column));

  return unplaced.filter((column, index) => unplaced.findIndex((other) => sameIgnoringCase(other, column)) === index).slice(0, MAX_COLUMNS_LOOKED_UP);
}

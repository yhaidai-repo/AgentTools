import type { ColumnElsewhere } from "./ColumnElsewhere";
import type { MissingTable } from "./MissingTable";
import type { TableAlias } from "./TableAlias";
import type { TableColumns } from "./TableColumns";
import type { WrongName } from "./WrongName";

/** What the database told about a failed query's names, for the hint the agent gets with the error. */
export interface WrongNameFacts {
  wrong: WrongName[];
  aliases: TableAlias[];
  found: TableColumns[];
  missing: MissingTable[];
  elsewhere: ColumnElsewhere[];
}

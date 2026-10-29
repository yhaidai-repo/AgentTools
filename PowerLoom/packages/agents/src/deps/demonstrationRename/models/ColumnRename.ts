// One text column an older version stored the agent's old name in.
export interface ColumnRename {
  table: string;
  column: string;
  legacy: string;
  renamed: string;
  /** equals: the whole value; prefix: the start of the value; contains: every occurrence inside the value. */
  match: "equals" | "prefix" | "contains";
  /** Narrows the rows by another column, a fixed SQL condition. */
  only?: string;
}

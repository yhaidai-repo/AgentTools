/** A table named in a query that the database doesn't have: the tables and views of that name in other schemas, and the closest other names. */
export interface MissingTable {
  table: string;
  sameName: string[];
  closest: string[];
}

/** A table named in a query that the database doesn't have, with the tables and views of that name in other schemas. */
export interface MissingTable {
  table: string;
  sameName: string[];
}

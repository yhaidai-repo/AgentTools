/** A table or view named in a query, as written there, with its columns in the database's order. */
export interface TableColumns {
  table: string;
  columns: string[];
}

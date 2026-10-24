/** A wrong column name the query's tables don't have, and the tables and views of the database that do. */
export interface ColumnElsewhere {
  column: string;
  tables: string[];
}

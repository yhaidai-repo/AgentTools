/** A table or view after FROM or JOIN, as written, and the alias the query gives it (empty when none). */
export interface TableAlias {
  table: string;
  alias: string;
}

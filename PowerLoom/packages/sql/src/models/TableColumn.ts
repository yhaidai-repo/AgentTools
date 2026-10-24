/** A column as sql_describe gives it, cut to what fixes a query: its type, PK when part of the primary key, and the column a foreign key references (empty when none). */
export interface TableColumn {
  name: string;
  type: string;
  key: string;
  references: string;
}

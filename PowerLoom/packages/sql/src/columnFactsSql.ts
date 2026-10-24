// What sql_describe and the wrong-name hint say about a column besides its name, for `c` in sys.columns: its type,
// PK when it's part of the primary key, and the column its foreign key references.
export const KEY_SQL = "CASE WHEN pk.column_id IS NULL THEN '' ELSE 'PK' END";

export const REFERENCES_SQL =
  "ISNULL(OBJECT_SCHEMA_NAME(fk.referenced_object_id) + '.' + OBJECT_NAME(fk.referenced_object_id) + '.' + COL_NAME(fk.referenced_object_id, fk.referenced_column_id), '')";

export const COLUMN_FACT_JOINS = `JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN (SELECT ic.object_id, ic.column_id FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id WHERE i.is_primary_key = 1) pk
  ON pk.object_id = c.object_id AND pk.column_id = c.column_id
LEFT JOIN sys.foreign_key_columns fk ON fk.parent_object_id = c.object_id AND fk.parent_column_id = c.column_id`;

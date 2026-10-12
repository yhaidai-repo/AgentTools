export interface SqlConnectionSettings {
  /** What agents pick the connection by: letters, digits, `_` and `-`. */
  name: string;
  /** Taken from the connection string when it was saved, so pages can show them without the string. */
  server: string;
  database: string;
  /** Stored in the database, never shown again (like the ADO token). */
  connectionString: string;
  enabled: boolean;
}

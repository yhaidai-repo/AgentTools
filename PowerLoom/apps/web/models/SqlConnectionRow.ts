// A Read SQL connection as the Settings page shows it: the browser never gets the connection string.
export interface SqlConnectionRow {
  name: string;
  server: string;
  database: string;
  enabled: boolean;
}

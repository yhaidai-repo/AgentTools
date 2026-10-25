// What the Google Drive panel shows: never the client's secret or the refresh token, only whether they are saved.
export interface GoogleDriveValues {
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
  account: string;
  folders: { id: string; name: string }[];
}

// A vault's Google Drive (user decision 2026-10-25), as the .NET backend saves it: the user's own OAuth client, the
// signed-in account's refresh token, and the folders agents may read (everything below them).
export interface GoogleDriveSettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  account: string;
  folders: { id: string; name: string }[];
}

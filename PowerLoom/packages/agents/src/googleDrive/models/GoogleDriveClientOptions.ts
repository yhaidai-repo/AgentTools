// The vault's Google OAuth client and its signed-in account's refresh token (Settings → Data access → Google Drive).
export interface GoogleDriveClientOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

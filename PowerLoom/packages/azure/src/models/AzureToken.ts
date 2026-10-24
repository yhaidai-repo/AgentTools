// A token as `az account get-access-token` prints it: what the Azure MCP server's AzureCliCredential parses.
export interface AzureToken {
  accessToken: string;
  /** Local time, `YYYY-MM-DD HH:mm:ss.ffffff`, as az prints it. */
  expiresOn: string;
  /** Unix seconds. */
  expires_on: number;
  tenant: string;
  tokenType: "Bearer";
}

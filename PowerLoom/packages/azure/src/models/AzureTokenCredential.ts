// The shape the Azure SDK clients take (@azure/core-auth TokenCredential), without depending on that package here.
export interface AzureTokenCredential {
  getToken(scopes: string | string[]): Promise<{ token: string; expiresOnTimestamp: number } | null>;
}

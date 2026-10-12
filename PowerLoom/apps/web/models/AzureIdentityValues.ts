// The browser never gets the secret, only whether one is saved.
export interface AzureIdentityValues {
  tenantId: string;
  clientId: string;
  hasSecret: boolean;
}

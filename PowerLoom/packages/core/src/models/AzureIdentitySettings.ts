// The vault's Entra app registration (service principal) with a client secret.
export interface AzureIdentitySettings {
  tenantId: string;
  clientId: string;
  /** Stored in the database, never shown again. */
  clientSecret: string;
}

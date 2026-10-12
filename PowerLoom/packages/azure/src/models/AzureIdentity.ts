// A vault's service principal with a client secret (user decision 2026-10-12).
export interface AzureIdentity {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

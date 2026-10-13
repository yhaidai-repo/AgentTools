// The user signed in for App Insights (device code), as the agent-runner saved it.
export interface AzureUserAccount {
  username: string;
  tenantId: string;
  signedInAt: string;
}

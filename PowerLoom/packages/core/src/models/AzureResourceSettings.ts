export type AzureResourceKind = "appInsights" | "cosmos" | "serviceBus" | "mongo";

export interface AzureResourceSettings {
  /** What agents pick the resource by: letters, digits, `_` and `-`. */
  name: string;
  kind: AzureResourceKind;
  /** The public part: a resource id (App Insights), an account endpoint (Cosmos) or a host (Service Bus, Mongo). */
  target: string;
  /** The key or connection string; empty for App Insights, which the user's own sign-in reads. Never shown. */
  secret: string;
  /** What pages show for the target. */
  display: string;
  enabled: boolean;
}

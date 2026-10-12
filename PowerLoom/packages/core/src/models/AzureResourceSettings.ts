export type AzureResourceKind = "appInsights" | "cosmos" | "serviceBus" | "mongo";

export interface AzureResourceSettings {
  /** What agents pick the resource by: letters, digits, `_` and `-`. */
  name: string;
  kind: AzureResourceKind;
  /** A resource id (App Insights, Service Bus), an account endpoint (Cosmos) or a connection string (Mongo, never shown). */
  target: string;
  /** What pages show for the target: the target itself, or only a connection string's host. */
  display: string;
  enabled: boolean;
}

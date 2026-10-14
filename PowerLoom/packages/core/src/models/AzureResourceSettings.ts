// `azureAccess` has no resources: the Azure MCP server's read tools see whatever the signed-in account sees. Cosmos
// and Mongo keep an allow-list of accounts (user decision 2026-10-14).
export type AzureResourceKind = "azureAccess" | "cosmos" | "mongo";

export interface AzureResourceSettings {
  /** What agents pick the resource by: letters, digits, `_` and `-`. */
  name: string;
  kind: AzureResourceKind;
  /** The Cosmos DB account name (also for Cosmos DB for MongoDB); keys come with the sign-in at call time. */
  target: string;
  /** What pages show for the target. */
  display: string;
  enabled: boolean;
}

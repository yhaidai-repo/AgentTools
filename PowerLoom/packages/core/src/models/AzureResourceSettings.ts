// `azureAccess` has no resources: the Azure MCP server's read tools see whatever the signed-in account sees. Cosmos
// and Mongo keep an allow-list of accounts; Service Bus keeps namespaces with a Listen-only connection string each
// (user decisions 2026-10-14).
export type AzureResourceKind = "azureAccess" | "cosmos" | "mongo" | "serviceBus";

export interface AzureResourceSettings {
  /** What agents pick the resource by: letters, digits, `_` and `-`. */
  name: string;
  kind: AzureResourceKind;
  /** The Cosmos DB account name (also for Cosmos DB for MongoDB), or the Service Bus namespace host. */
  target: string;
  /** Service Bus only: the Listen-only connection string; empty for the accounts, whose keys come with the sign-in. Never shown. */
  secret: string;
  /** What pages show for the target. */
  display: string;
  enabled: boolean;
}

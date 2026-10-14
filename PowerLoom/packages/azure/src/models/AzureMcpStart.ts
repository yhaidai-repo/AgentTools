// How the runner starts the Azure MCP server for one run.
export interface AzureMcpStart {
  /** The service namespaces to expose (`monitor`, `cosmos`, …). */
  namespaces: string[];
  /** Added to the server's environment: the sign-in's tenant, the default subscription, where the `az` shim asks for tokens. */
  env: Record<string, string>;
}

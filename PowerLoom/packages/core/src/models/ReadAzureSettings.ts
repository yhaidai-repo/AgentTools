import type { AzureResourceKind, AzureResourceSettings } from "./AzureResourceSettings";

// A vault's Read Azure (user decisions 2026-10-12/14): one switch per kind; agents with a kind's integration switched
// on get its tools, read with the vault's own sign-in. Saved by PowerLoom's backend; read here.
export interface ReadAzureSettings {
  /** Kind → switched on; a kind not in the map is off. */
  enabledKinds: Partial<Record<AzureResourceKind, boolean>>;
  resources: AzureResourceSettings[];
  /** The subscription (id or name) the Azure MCP server uses when a tool call names none; empty = the agent must name one. */
  subscription: string;
}

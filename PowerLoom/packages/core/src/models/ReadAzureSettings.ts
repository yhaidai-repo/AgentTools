import type { AzureIdentitySettings } from "./AzureIdentitySettings";
import type { AzureResourceSettings } from "./AzureResourceSettings";

// A vault's Read Azure (user decision 2026-10-12): agents with a kind's integration switched on read these resources
// while the vault's switch is on. Saved by PowerLoom's backend; read here.
export interface ReadAzureSettings {
  enabled: boolean;
  /** Null until the service principal was saved once. Mongo resources don't use it. */
  identity: AzureIdentitySettings | null;
  resources: AzureResourceSettings[];
}

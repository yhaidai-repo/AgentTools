import type { AzureResourceKind, AzureResourceSettings } from "./AzureResourceSettings";

// A vault's Read Azure (user decisions 2026-10-12/13): one feature per kind with its own switch; agents with a kind's
// integration switched on read its enabled resources. Saved by PowerLoom's backend; read here.
export interface ReadAzureSettings {
  /** Kind → switched on; a kind not in the map is off. */
  enabledKinds: Partial<Record<AzureResourceKind, boolean>>;
  resources: AzureResourceSettings[];
}

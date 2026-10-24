import type { AdoSettings } from "./models/AdoSettings";
import type { ReadAzureSettings } from "./models/ReadAzureSettings";
import type { ReadSqlSettings } from "./models/ReadSqlSettings";
import type { VaultSettingsView } from "./models/VaultSettingsView";
import { isAdoConfigured } from "./settings";

// The settings that hold a secret, as settings.get shows them: the fields a page shows, and whether a secret is saved.
export function adoView(ado: AdoSettings | null): VaultSettingsView["ado"] {
  return { enabled: ado?.enabled ?? false, configured: isAdoConfigured(ado), orgUrl: ado?.orgUrl ?? "", project: ado?.project ?? "", team: ado?.team ?? "", user: ado?.user ?? "", hasToken: Boolean(ado?.pat) };
}

export function sqlView(settings: ReadSqlSettings): VaultSettingsView["readSql"] {
  return { enabled: settings.enabled, connections: settings.connections.map((connection) => ({ name: connection.name, server: connection.server, database: connection.database, enabled: connection.enabled })) };
}

export function azureView(settings: ReadAzureSettings, signedInAs: string | null): VaultSettingsView["readAzure"] {
  const resources = settings.resources.map((resource) => ({ name: resource.name, kind: resource.kind, display: resource.display, enabled: resource.enabled }));

  return { enabledKinds: settings.enabledKinds, subscription: settings.subscription, signedInAs, resources };
}

// A vault's DevHub (user decision 2026-10-13): agents with the integration switched on start chains of the
// vault's services on the Windows host through DevHub while the vault's switch is on. Saved by
// PowerLoom's backend; read here. The token is the dev-secrets value dev-hub-token.
export interface DevHubSettings {
  enabled: boolean;
  url: string;
  token: string;
}

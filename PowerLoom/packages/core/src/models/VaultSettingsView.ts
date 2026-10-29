import type { CleanupSettings } from "./CleanupSettings";
import type { ImportSettings } from "./ImportSettings";
import type { ImportSourceActivity } from "./ImportSourceActivity";
import type { PullRequestSettings } from "./PullRequestSettings";
import type { SandboxSettingsView } from "./SandboxSettingsView";
import type { SyncSettings } from "./SyncSettings";

// A vault's Settings as a chat may read them (open decision MCPQ-007: reads only): every switch and choice, never a
// secret (no ADO token, connection string, DevHub token or sign-in cache), only whether one is saved.
export interface VaultSettingsView {
  vault: string;
  features: { adoSync: boolean; mailSync: boolean; pullRequests: boolean } | null;
  ado: { enabled: boolean; configured: boolean; orgUrl: string; project: string; team: string; user: string; hasToken: boolean };
  sync: SyncSettings;
  imports: { settings: ImportSettings; sources: ImportSourceActivity[] };
  pullRequests: PullRequestSettings;
  repos: { id: string; name: string; kind: string; enabled: boolean; defaultBranch: string | null; build: string | null; test: string | null }[];
  sandbox: SandboxSettingsView;
  readSql: { enabled: boolean; connections: { name: string; server: string; database: string; enabled: boolean }[] };
  readAzure: { enabledKinds: Record<string, boolean | undefined>; subscription: string; signedInAs: string | null; resources: { name: string; kind: string; display: string; enabled: boolean }[] };
  devHub: { enabled: boolean; url: string; hasToken: boolean };
  github: { enabled: boolean; owner: string; login: string; hasToken: boolean };
  googleDrive: { enabled: boolean; account: string; folders: { id: string; name: string }[] };
  cleanup: CleanupSettings;
}

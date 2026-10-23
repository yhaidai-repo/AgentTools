// One vault's integrations and their last syncs; the dates are ISO strings as the API sends them.
export interface VaultStatus {
  name: string;
  adoEnabled: boolean;
  adoConfigured: boolean;
  lastPbiSyncAt: string | null;
  lastPullRequestSyncAt: string | null;
  importConfigured: boolean;
  importCheckedAt: string | null;
}

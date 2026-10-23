// The Vault page's Usage tab as a chat reads it: the most used notes in the period (reads, searches and shell uses by the
// chosen agent) and the notes nobody used, with when they were last used at all (null = never).
export interface VaultUsageSummary {
  mostUsed: { path: string; title: string; uses: number; lastUsedAt: Date | null }[];
  notUsed: { path: string; title: string; lastUsedAt: Date | null }[];
}

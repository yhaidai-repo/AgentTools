export interface VaultAttachment {
  id: number;
  ref: string;
  fileName: string;
  vaultName: string;
  itemId: string | null;
  sourceUrl: string | null;
}
